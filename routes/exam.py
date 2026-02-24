from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime, timedelta
import json
import requests as http_requests
from models import Exam, ExamAnswer, Question, Subject, User
from extensions import db
from config import Config

exam = Blueprint('exam', __name__)

@exam.route('/exams')
@login_required
def select():
    grades = list(range(1, 11))
    subjects = Subject.query.all()
    return render_template('exam/select.html', grades=grades, subjects=subjects)


@exam.route('/exams/subjects/<int:grade>')
@login_required
def get_subjects(grade):
    subject_ids = db.session.query(Question.subject_id).filter_by(grade=grade).distinct().all()
    subject_ids = [s[0] for s in subject_ids]
    subjects = Subject.query.filter(Subject.id.in_(subject_ids)).all()
    return jsonify([{'id': s.id, 'name': s.name, 'icon': s.icon} for s in subjects])


@exam.route('/exams/start/<int:grade>/<int:subject_id>')
@login_required
def start(grade, subject_id):
    questions = Question.query.filter_by(grade=grade, subject_id=subject_id).order_by(db.func.random()).limit(Config.QUESTIONS_PER_EXAM).all()
    if not questions:
        flash('No questions available for this grade and subject.', 'warning')
        return redirect(url_for('exam.select'))

    new_exam = Exam(user_id=current_user.id, grade=grade, subject_id=subject_id,
                    total_marks=sum(q.marks for q in questions))
    db.session.add(new_exam)
    db.session.commit()

    for q in questions:
        answer = ExamAnswer(exam_id=new_exam.id, question_id=q.id)
        db.session.add(answer)
    db.session.commit()

    return redirect(url_for('exam.take', exam_id=new_exam.id))


@exam.route('/exams/take/<int:exam_id>')
@login_required
def take(exam_id):
    exam_obj = Exam.query.get_or_404(exam_id)
    if exam_obj.user_id != current_user.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('exam.select'))
    if exam_obj.is_completed:
        if exam_obj.is_cancelled:
            return redirect(url_for('exam.cancelled', exam_id=exam_id))
        return redirect(url_for('exam.result', exam_id=exam_id))

    # check if timer expired
    deadline = exam_obj.started_at + timedelta(minutes=Config.EXAM_DURATION_MINUTES)
    if datetime.utcnow() > deadline:
        return redirect(url_for('exam.finish', exam_id=exam_id))

    # find next unanswered question
    all_answers = ExamAnswer.query.filter_by(exam_id=exam_id).all()
    current_answer = None
    answered_count = 0
    for a in all_answers:
        if a.student_answer and a.student_answer.strip():
            answered_count += 1
        elif current_answer is None:
            current_answer = a

    if current_answer is None:
        return redirect(url_for('exam.finish', exam_id=exam_id))

    q = current_answer.question
    question_data = {
        'answer_id': current_answer.id,
        'question_id': q.id,
        'type': q.question_type,
        'text': q.question_text,
        'marks': q.marks
    }

    # show feedback from previous answer if available
    last_feedback = None
    last_answered = ExamAnswer.query.filter(
        ExamAnswer.exam_id == exam_id,
        ExamAnswer.student_answer != '',
        ExamAnswer.student_answer.isnot(None)
    ).order_by(ExamAnswer.id.desc()).first()
    if last_answered:
        last_feedback = {
            'question': last_answered.question.question_text,
            'answer': last_answered.student_answer,
            'eval': 'correct' if last_answered.ai_score and last_answered.ai_score > 0 else 'incorrect',
            'feedback': last_answered.ai_feedback
        }

    subject = db.session.get(Subject, exam_obj.subject_id)
    remaining_seconds = max(0, int((deadline - datetime.utcnow()).total_seconds()))

    return render_template('exam/take.html',
                           exam=exam_obj, question=question_data, subject=subject,
                           question_num=answered_count + 1,
                           total_questions=len(all_answers),
                           remaining_seconds=remaining_seconds,
                           last_feedback=last_feedback)


@exam.route('/exams/submit_answer/<int:exam_id>', methods=['POST'])
@login_required
def submit_answer(exam_id):
    exam_obj = Exam.query.get_or_404(exam_id)
    if exam_obj.user_id != current_user.id or exam_obj.is_completed:
        flash('Invalid submission.', 'danger')
        return redirect(url_for('exam.select'))

    # check timer
    deadline = exam_obj.started_at + timedelta(minutes=Config.EXAM_DURATION_MINUTES)
    if datetime.utcnow() > deadline:
        return redirect(url_for('exam.finish', exam_id=exam_id))

    answer_id = request.form.get('answer_id', type=int)
    student_ans = request.form.get('student_answer', '').strip()

    answer = ExamAnswer.query.get_or_404(answer_id)
    if answer.exam_id != exam_id:
        flash('Invalid answer.', 'danger')
        return redirect(url_for('exam.select'))

    answer.student_answer = student_ans

    # don't grade empty answers
    if not student_ans:
        answer.ai_score = 0
        answer.ai_feedback = 'No answer provided'
    else:
        # grade with GPT-4.1-mini
        try:
            eval_result = _ai_evaluate(answer.question.question_text, student_ans)
            if eval_result == 'correct':
                answer.ai_score = float(answer.question.marks)
                answer.ai_feedback = 'Correct!'
            else:
                answer.ai_score = 0
                answer.ai_feedback = 'Incorrect'
        except Exception:
            _fallback_grade(answer, student_ans)

    db.session.commit()

    # check if there are more questions
    unanswered = ExamAnswer.query.filter(
        ExamAnswer.exam_id == exam_id,
        (ExamAnswer.student_answer == '') | (ExamAnswer.student_answer.is_(None))
    ).count()

    if unanswered == 0:
        return redirect(url_for('exam.finish', exam_id=exam_id))

    return redirect(url_for('exam.take', exam_id=exam_id))


@exam.route('/exams/swap_question/<int:exam_id>', methods=['POST'])
@login_required
def swap_question(exam_id):
    """Replace current unanswered question with a random one."""
    exam_obj = Exam.query.get_or_404(exam_id)
    if exam_obj.user_id != current_user.id or exam_obj.is_completed:
        return jsonify({'status': 'error'}), 400

    # find current unanswered question
    all_answers = ExamAnswer.query.filter_by(exam_id=exam_id).all()
    current_answer = None
    used_question_ids = [a.question_id for a in all_answers]

    for a in all_answers:
        if not a.student_answer or not a.student_answer.strip():
            current_answer = a
            break

    if not current_answer:
        return jsonify({'status': 'no_questions'})

    # pick a new question (same grade+subject, not already used)
    new_question = Question.query.filter(
        Question.grade == exam_obj.grade,
        Question.subject_id == exam_obj.subject_id,
        ~Question.id.in_(used_question_ids)
    ).order_by(db.func.random()).first()

    if new_question:
        old_marks = current_answer.question.marks
        current_answer.question_id = new_question.id
        exam_obj.total_marks = exam_obj.total_marks - old_marks + new_question.marks
        db.session.commit()
        return jsonify({'status': 'swapped'})

    return jsonify({'status': 'no_replacement'})


def _fallback_grade(answer, student_ans):
    """Simple fallback when AI is unavailable."""
    if student_ans.lower().strip() == answer.question.correct_answer.lower().strip():
        answer.ai_score = float(answer.question.marks)
        answer.ai_feedback = 'Correct! (auto-graded)'
    else:
        answer.ai_score = 0
        answer.ai_feedback = 'Incorrect (auto-graded)'


def _ai_evaluate(question_text, student_answer):
    """Call OpenAI to evaluate the answer."""
    api_key = Config.OPENAI_API_KEY
    if not api_key or api_key == '':
        raise ValueError('OpenAI API key not configured')

    resp = http_requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        },
        json={
            'model': 'gpt-4.1-mini',
            'messages': [
                {
                    'role': 'system',
                    'content': (
                        'You are a strict exam evaluator for school students (Grades 1-10). '
                        'You will receive a question and a student\'s answer. '
                        'Evaluate if the answer is correct or incorrect. '
                        'Spelling mistakes are acceptable if the meaning is clear. '
                        'The answer does not need to be word-for-word but must demonstrate understanding. '
                        'Respond with ONLY valid JSON: {"eval":"correct"} or {"eval":"incorrect"}'
                    )
                },
                {
                    'role': 'user',
                    'content': f'Question: {question_text}\nStudent Answer: {student_answer}'
                }
            ],
            'temperature': 0,
            'max_tokens': 20
        },
        timeout=15
    )
    resp.raise_for_status()
    content = resp.json()['choices'][0]['message']['content'].strip()
    data = json.loads(content)
    return data.get('eval', 'incorrect').lower()


@exam.route('/exams/cancel/<int:exam_id>', methods=['POST'])
@login_required
def cancel(exam_id):
    """Cancel exam due to anti-cheat violation (called from vision proctoring JS)."""
    exam_obj = Exam.query.get_or_404(exam_id)
    if exam_obj.user_id != current_user.id or exam_obj.is_completed or exam_obj.is_cancelled:
        return jsonify({'status': 'error'}), 400

    data = request.get_json(silent=True) or {}
    reason = data.get('reason', 'Anti-cheat violation')

    exam_obj.is_cancelled = True
    exam_obj.is_completed = True
    exam_obj.completed_at = datetime.utcnow()
    exam_obj.cancelled_reason = reason
    exam_obj.score = 0
    exam_obj.xp_earned = 0
    db.session.commit()

    return jsonify({'status': 'cancelled'})


@exam.route('/exams/cancelled/<int:exam_id>')
@login_required
def cancelled(exam_id):
    exam_obj = Exam.query.get_or_404(exam_id)
    if exam_obj.user_id != current_user.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('exam.select'))
    subject = db.session.get(Subject, exam_obj.subject_id)
    return render_template('exam/cancelled.html', exam=exam_obj, subject=subject)


@exam.route('/exams/finish/<int:exam_id>')
@login_required
def finish(exam_id):
    exam_obj = Exam.query.get_or_404(exam_id)
    if exam_obj.user_id != current_user.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('exam.select'))
    if exam_obj.is_completed:
        return redirect(url_for('exam.result', exam_id=exam_id))

    answers = ExamAnswer.query.filter_by(exam_id=exam_id).all()
    total_score = sum(a.ai_score or 0 for a in answers)
    correct_count = sum(1 for a in answers if a.ai_score and a.ai_score > 0)

    exam_obj.score = total_score
    exam_obj.is_completed = True
    exam_obj.completed_at = datetime.utcnow()

    # XP: proportional to correct answers
    total_questions = len(answers)
    xp_per_correct = Config.XP_PER_EXAM // total_questions if total_questions > 0 else 0
    earned_xp = correct_count * xp_per_correct
    exam_obj.xp_earned = earned_xp

    current_user.xp += earned_xp
    db.session.commit()

    flash(f'Exam completed! {correct_count}/{total_questions} correct — You earned {earned_xp} XP!', 'success')
    return redirect(url_for('exam.result', exam_id=exam_id))


@exam.route('/exams/result/<int:exam_id>')
@login_required
def result(exam_id):
    exam_obj = Exam.query.get_or_404(exam_id)
    if exam_obj.user_id != current_user.id:
        flash('Access denied.', 'danger')
        return redirect(url_for('exam.select'))

    answers = ExamAnswer.query.filter_by(exam_id=exam_id).all()
    subject = db.session.get(Subject, exam_obj.subject_id)
    return render_template('exam/result.html', exam=exam_obj, answers=answers, subject=subject)
