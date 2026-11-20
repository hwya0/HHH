FROM python:3.14-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.pyc serve.py ./
COPY templates ./templates
COPY static ./static
COPY data ./data_tpl
COPY entrypoint.sh ./
RUN chmod +x /app/entrypoint.sh
ENV HOST=0.0.0.0
ENV PORT=5000
EXPOSE 5000
CMD ["bash", "entrypoint.sh"]