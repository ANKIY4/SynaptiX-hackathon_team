from flask import Blueprint, render_template
from flask_login import login_required, current_user
from models import Exam, User

dashboard = Blueprint('dashboard', __name__)


@dashboard.route('/')
@dashboard.route('/dashboard')
@login_required
def index():
    exams = Exam.query.filter_by(user_id=current_user.id, is_completed=True).order_by(Exam.completed_at.desc()).all()
    total_exams = len(exams)
    avg_score = 0
    if total_exams > 0:
        total_marks_sum = sum(e.total_marks for e in exams if e.total_marks > 0)
        if total_marks_sum > 0:
            avg_score = (sum(e.score for e in exams) / total_marks_sum) * 100

    # level calc: 1000 XP per level
    level = current_user.xp // 1000 + 1
    xp_in_level = current_user.xp % 1000
    xp_progress = (xp_in_level / 1000) * 100

    return render_template('dashboard.html', exams=exams, total_exams=total_exams,
                           avg_score=round(avg_score, 1), level=level,
                           xp_in_level=xp_in_level, xp_progress=xp_progress)
