from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from functools import wraps
from models import Question, Subject
from forms import QuestionForm
from extensions import db

admin = Blueprint('admin', __name__, url_prefix='/admin')


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            flash('Admin access required.', 'danger')
            return redirect(url_for('dashboard.index'))
        return f(*args, **kwargs)
    return decorated_function


@admin.route('/')
@login_required
@admin_required
def index():
    questions = Question.query.order_by(Question.grade, Question.subject_id).all()
    return render_template('admin/questions.html', questions=questions)


@admin.route('/add', methods=['GET', 'POST'])
@login_required
@admin_required
def add_question():
    form = QuestionForm()
    form.subject_id.choices = [(s.id, s.name) for s in Subject.query.order_by(Subject.name).all()]
    if form.validate_on_submit():
        question = Question(
            grade=int(form.grade.data),
            subject_id=form.subject_id.data,
            question_type=form.question_type.data,
            question_text=form.question_text.data,
            correct_answer=form.correct_answer.data,
            marks=form.marks.data
        )
        db.session.add(question)
        db.session.commit()
        flash('Question added successfully!', 'success')
        return redirect(url_for('admin.index'))
    return render_template('admin/add_question.html', form=form)


@admin.route('/edit/<int:question_id>', methods=['GET', 'POST'])
@login_required
@admin_required
def edit_question(question_id):
    question = Question.query.get_or_404(question_id)
    form = QuestionForm(obj=question)
    form.subject_id.choices = [(s.id, s.name) for s in Subject.query.order_by(Subject.name).all()]
    if form.validate_on_submit():
        question.grade = int(form.grade.data)
        question.subject_id = form.subject_id.data
        question.question_type = form.question_type.data
        question.question_text = form.question_text.data
        question.correct_answer = form.correct_answer.data
        question.marks = form.marks.data
        db.session.commit()
        flash('Question updated!', 'success')
        return redirect(url_for('admin.index'))
    form.grade.data = str(question.grade)
    return render_template('admin/add_question.html', form=form, editing=True)


@admin.route('/delete/<int:question_id>', methods=['POST'])
@login_required
@admin_required
def delete_question(question_id):
    question = Question.query.get_or_404(question_id)
    db.session.delete(question)
    db.session.commit()
    flash('Question deleted.', 'info')
    return redirect(url_for('admin.index'))
