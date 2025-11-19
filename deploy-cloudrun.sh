#!/bin/bash

# Cloud Run 部署腳本
PROJECT_ID="auto-recheck"
SERVICE_NAME="auto-recheck-service"
REGION="asia-east1"

echo "🚀 開始部署到 Google Cloud Run..."

# 構建並推送 Docker 映像
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# 部署到 Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 540 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production"

echo "✅ 部署完成！"
