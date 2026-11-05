from celery import Celery
import os

app = Celery('tasks', broker=os.environ.get('REDIS_URL','redis://redis:6379/0'))

@app.task
def hello():
    return 'hello from worker'
