from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, BooleanField, SelectField, TextAreaField, IntegerField
from wtforms.validators import DataRequired, Email, EqualTo, Length, ValidationError, NumberRange
from models import User


class SignupForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=3, max=80)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=6)])
    confirm_password = PasswordField('Confirm Password', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Sign Up')

    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user:
            raise ValidationError('Username already taken.')

    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user:
            raise ValidationError('Email already registered.')


class LoginForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired()])
    remember = BooleanField('Remember Me')
    submit = SubmitField('Log In')


class QuestionForm(FlaskForm):
    grade = SelectField('Grade', choices=[(str(i), f'Grade {i}') for i in range(1, 11)], validators=[DataRequired()])
    subject_id = SelectField('Subject', coerce=int, validators=[DataRequired()])
    question_type = SelectField('Question Type', choices=[
        ('very_short', 'Very Short (1-2 words)'),
        ('short', 'Short (1-2 sentences)'),
        ('long', 'Long (paragraph)')
    ], validators=[DataRequired()])
    question_text = TextAreaField('Question', validators=[DataRequired()])
    correct_answer = TextAreaField('Correct Answer', validators=[DataRequired()])
    marks = IntegerField('Marks', validators=[DataRequired(), NumberRange(min=1, max=10)], default=1)
    submit = SubmitField('Save Question')
