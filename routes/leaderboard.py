from flask import Blueprint, render_template, jsonify
from models import User, Exam
from extensions import db

leaderboard = Blueprint('leaderboard', __name__)


@leaderboard.route('/leaderboard')
def index():
    users = User.query.filter_by(is_admin=False).order_by(User.xp.desc()).all()
    leaderboard_data = []
    for rank, user in enumerate(users, 1):
        exam_count = Exam.query.filter_by(user_id=user.id, is_completed=True).count()
        leaderboard_data.append({
            'rank': rank,
            'username': user.username,
            'xp': user.xp,
            'exams_taken': exam_count,
            'level': user.xp // 1000 + 1
        })
    return render_template('leaderboard.html', leaderboard=leaderboard_data)


@leaderboard.route('/api/leaderboard')
def api_leaderboard():
    users = User.query.filter_by(is_admin=False).order_by(User.xp.desc()).all()
    data = []
    for rank, user in enumerate(users, 1):
        exam_count = Exam.query.filter_by(user_id=user.id, is_completed=True).count()
        data.append({
            'rank': rank,
            'username': user.username,
            'xp': user.xp,
            'exams_taken': exam_count,
            'level': user.xp // 1000 + 1
        })
    return jsonify(data)
