from flask import Flask
from config import Config
from extensions import db, login_manager, csrf
from models import User, Subject

#main application factory
def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)

    from routes.auth import auth
    from routes.exam import exam
    from routes.dashboard import dashboard
    from routes.leaderboard import leaderboard

    app.register_blueprint(auth)
    app.register_blueprint(exam)
    app.register_blueprint(dashboard)
    app.register_blueprint(leaderboard)

    with app.app_context():
        db.create_all()
        seed_data()

    return app


def seed_data():
    if Subject.query.count() == 0:
        subjects = [
            Subject(name='Mathematics', icon='M'),
            Subject(name='Science', icon='S'),
            Subject(name='English', icon='E'),
            Subject(name='Nepali', icon='N'),
            Subject(name='Social Science', icon='SS'),
            Subject(name='Computer Science', icon='CS'),
        ]
        db.session.add_all(subjects)
        db.session.commit()

app = create_app()

if __name__  == '__main__':
    app.run(debug=True, port=5000)