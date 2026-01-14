# Deployment Guide - Espaço do Saber

## Prerequisites

### Required Software
- Docker 20.10+
- Docker Compose 1.29+
- Java 17 (for local development)
- Node.js 18+ (for local development)
- PostgreSQL 15+ (if not using Docker)

### Environment Setup

1. **Clone the Repository**
```bash
git clone https://github.com/pedronm/espaco-do-saber.git
cd espaco-do-saber
```

2. **Set Environment Variables**

Create a `.env` file in the project root:

```bash
# Database Configuration
POSTGRES_DB=espacodosaber
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password

# JWT Configuration (Generate with: openssl rand -base64 64)
JWT_SECRET=your_very_long_and_secure_secret_key_min_256_bits

# CORS Origins (comma-separated for production)
CORS_ORIGINS=http://localhost:4200,https://yourdomain.com

# Backend API URL
API_URL=http://localhost:8080
```

## Deployment Options

### Option 1: Docker Compose (Recommended for Production)

1. **Build and Start All Services**
```bash
docker-compose up --build
```

This will start:
- PostgreSQL database on port 5432
- Backend API on port 8080
- Frontend on port 4200

2. **Access the Application**
- Frontend: http://localhost:4200
- Backend API: http://localhost:8080
- Database: localhost:5432

3. **Stop Services**
```bash
docker-compose down
```

4. **Stop and Remove Volumes**
```bash
docker-compose down -v
```

### Option 2: Manual Deployment

#### Backend Deployment

1. **Build the Backend**
```bash
cd backend
mvn clean package -DskipTests
```

2. **Run the Backend**
```bash
java -jar target/streaming-platform-1.0.0.jar \
  --spring.datasource.url=jdbc:postgresql://localhost:5432/espacodosaber \
  --spring.datasource.username=postgres \
  --spring.datasource.password=your_password \
  --jwt.secret=your_jwt_secret
```

#### Frontend Deployment

1. **Install Dependencies**
```bash
cd frontend
npm install
```

2. **Build for Production**
```bash
npm run build
```

3. **Deploy with Nginx**

Create nginx configuration at `/etc/nginx/sites-available/espacodosaber`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    root /var/www/espacodosaber/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/espacodosaber /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Option 3: Cloud Deployment

#### AWS Deployment

1. **Backend on Elastic Beanstalk**
```bash
# Install EB CLI
pip install awsebcli

# Initialize EB
cd backend
eb init

# Create environment
eb create production

# Deploy
eb deploy
```

2. **Frontend on S3 + CloudFront**
```bash
# Build
cd frontend
npm run build

# Deploy to S3
aws s3 sync dist/ s3://your-bucket-name/

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

3. **Database on RDS**
- Create PostgreSQL RDS instance
- Update backend datasource URL

#### Heroku Deployment

1. **Backend**
```bash
cd backend
heroku create espacodosaber-backend
heroku addons:create heroku-postgresql:hobby-dev
git push heroku main
```

2. **Frontend**
```bash
cd frontend
heroku create espacodosaber-frontend
heroku buildpacks:set heroku/nodejs
git push heroku main
```

## Production Configuration

### Security Checklist

- [ ] Change default JWT secret to a secure random value
- [ ] Update database password
- [ ] Configure HTTPS/SSL certificates
- [ ] Set up firewall rules
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Set up backup strategy
- [ ] Enable application logging
- [ ] Configure monitoring and alerts

### Performance Optimization

1. **Backend**
- Enable connection pooling
- Configure caching (Redis)
- Optimize database queries
- Enable compression

2. **Frontend**
- Enable gzip compression
- Configure CDN
- Optimize images and videos
- Enable lazy loading

### Monitoring

1. **Application Logs**
```bash
# Docker logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Application logs
tail -f backend/logs/application.log
```

2. **Health Checks**
- Backend: http://localhost:8080/actuator/health
- Frontend: http://localhost:4200

3. **Metrics**
- Configure Spring Boot Actuator
- Set up Prometheus and Grafana
- Monitor database performance

## Troubleshooting

### Common Issues

**Issue: Database connection failed**
```bash
# Check PostgreSQL is running
docker-compose ps
# Check logs
docker-compose logs postgres
```

**Issue: Backend not starting**
```bash
# Check Java version
java -version
# Check logs
docker-compose logs backend
```

**Issue: Frontend 404 errors**
```bash
# Verify build completed
ls frontend/dist
# Check nginx configuration
nginx -t
```

**Issue: CORS errors**
- Update `cors.allowed-origins` in backend configuration
- Verify frontend API URL matches backend

### Backup and Restore

**Backup Database**
```bash
docker exec espacodosaber-db pg_dump -U postgres espacodosaber > backup.sql
```

**Restore Database**
```bash
docker exec -i espacodosaber-db psql -U postgres espacodosaber < backup.sql
```

## Scaling

### Horizontal Scaling

1. **Load Balancer Configuration**
```yaml
# docker-compose.scale.yml
services:
  backend:
    deploy:
      replicas: 3
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - backend
```

2. **Start Scaled Services**
```bash
docker-compose -f docker-compose.yml -f docker-compose.scale.yml up --scale backend=3
```

### Vertical Scaling

Update Docker resource limits:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

## Maintenance

### Update Application

1. **Pull Latest Code**
```bash
git pull origin main
```

2. **Rebuild and Restart**
```bash
docker-compose build
docker-compose up -d
```

### Database Migration

```bash
# Backup before migration
docker exec espacodosaber-db pg_dump -U postgres espacodosaber > pre-migration-backup.sql

# Run migration
cd backend
mvn flyway:migrate
```

## Support

For issues or questions:
- Check logs: `docker-compose logs`
- Review README.md
- Check GitHub Issues
- Contact development team

## License

This project is licensed under the MIT License.
