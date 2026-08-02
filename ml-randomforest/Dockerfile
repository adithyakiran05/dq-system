FROM public.ecr.aws/lambda/python:3.12

# Copy requirements and install
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --upgrade pip && pip install -r requirements.txt --only-binary=:all: || pip install -r requirements.txt

# Copy function code
COPY trigger_lambda.py ${LAMBDA_TASK_ROOT}
COPY trainer_lambda.py ${LAMBDA_TASK_ROOT}
COPY ml_model.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "trigger_lambda.lambda_handler" ]
