# Espaço do Saber - Streaming Platform

Portal dedicado a hospedagem, compartilhamento e gerenciamento dos cursos da CPMA - A comprehensive video streaming platform for educational content.

## Overview

Espaço do Saber is a full-stack streaming platform that enables teachers to upload and stream educational videos, while students can access content and receive support through an integrated chat system.

### Key Features

- **Custom OAuth Authentication**: Secure authentication with JWT tokens
- **Three Role System**: Admin, Teacher, and Student roles with different permissions
- **Video Management**: Upload, store, and manage video content
- **Live & On-Demand Streaming**: Support for both live streams and recorded videos
- **Access Tracking**: Monitor student access and presence data
- **Real-time Chat**: WebSocket-based chat for student support
- **Responsive UI**: Modern Angular frontend with intuitive interface

## Technology Stack

### Backend
- **Java 17** with **Spring Boot 3.2.1**
- **Spring Security** with custom OAuth2
- **JWT** for token-based authentication
- **JPA/Hibernate** for database access
- **PostgreSQL** database
- **WebSocket** for real-time chat
- **Gradle** for dependency management

### Frontend
- **Angular 19**
- **RxJS** for reactive programming
- **SockJS & STOMP** for WebSocket communication
- **TypeScript**

### DevOps
- **Docker** & **Docker Compose**
- **Nginx** for frontend serving and reverse proxy
- **PostgreSQL** containerized database

## Architecture

### Backend Structure
```
backend/
├── src/main/java/com/espacodosaber/
│   ├── config/          # Security and WebSocket configuration
│   ├── controller/      # REST API endpoints
│   ├── dto/             # Data Transfer Objects
│   ├── model/           # Entity models
│   ├── repository/      # JPA repositories
│   ├── security/        # JWT and authentication components
│   └── service/         # Business logic
├── src/main/resources/
│   └── application.yml
└── build.gradle
```

### Frontend Structure
```
frontend/
├── src/app/
│   ├── auth/            # Authentication components
│   ├── teacher/         # Teacher dashboard
│   ├── student/         # Student dashboard
│   ├── admin/           # Admin dashboard
│   └── shared/          # Shared services, models, guards
├── angular.json
└── package.json
```

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Java 17 (for local development)
- Node.js 18+ (for local development)
- Gradle 8.5+ (for local development)

### Quick Start with Docker

1. Clone the repository:
```bash
git clone https://github.com/pedronm/espaco-do-saber.git
cd espaco-do-saber
```

2. Build and run with Docker Compose:
```bash
docker-compose up --build
```

3. Access the application:
   - Frontend: http://localhost:4200
   - Backend API: http://localhost:8080
   - Database: localhost:5432

### Local Development Setup

#### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Configure database in `application.yml` or use H2 for development

3. Build and run:
```bash
./gradlew clean build
./gradlew bootRun
```

The backend will start on http://localhost:8080

#### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm start
```

The frontend will start on http://localhost:4200

## API Documentation

### Authentication Endpoints

#### Register
```
POST /api/auth/register
Content-Type: application/json

{
  "username": "string",
  "email": "string",
  "password": "string",
  "fullName": "string",
  "role": "STUDENT|TEACHER|ADMIN"
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}

Response:
{
  "token": "JWT_TOKEN",
  "type": "Bearer",
  "id": 1,
  "username": "string",
  "email": "string",
  "role": "string"
}
```

### Video Endpoints

#### Upload Video (Teacher/Admin only)
```
POST /api/videos/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: (video file)
title: string
description: string
isPublic: boolean
isLive: boolean
```

#### Get Public Videos
```
GET /api/videos/public
```

#### Get My Videos (Teacher only)
```
GET /api/videos/my-videos
Authorization: Bearer {token}
```

#### Stream Video
```
GET /api/videos/stream/{id}
```

### Chat Endpoints

#### Send Message
```
WebSocket: /app/chat.send
Subscribe: /topic/messages
```

#### Get Conversation
```
GET /api/chat/conversation/{userId}
Authorization: Bearer {token}
```

#### Get Unread Messages
```
GET /api/chat/unread
Authorization: Bearer {token}
```

## User Roles

### Admin
- Full system access
- User management
- Video management
- Access to all features

### Teacher
- Upload and manage own videos
- Configure video visibility (public/private)
- Start live streams
- View analytics

### Student
- View public videos
- Access assigned content
- Chat support
- Track viewing progress

## Configuration

### Backend Configuration

Edit `backend/src/main/resources/application.yml`:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/espacodosaber
    username: postgres
    password: postgres
  servlet:
    multipart:
      max-file-size: 500MB
      max-request-size: 500MB

jwt:
  secret: your-secret-key-change-this-in-production-min-256-bits-long-secret-key
  expiration: 86400000

cors:
  allowed-origins: http://localhost:4200
```

### Frontend Configuration

Edit API URLs in service files if needed:
- `frontend/src/app/shared/services/auth.service.ts`
- `frontend/src/app/shared/services/video.service.ts`
- `frontend/src/app/shared/services/chat.service.ts`

## Security Considerations

1. **JWT Secret**: Change the default JWT secret in production
2. **HTTPS**: Use HTTPS in production environments
3. **CORS**: Configure appropriate CORS origins
4. **File Upload**: Implement file type validation and virus scanning
5. **Rate Limiting**: Add rate limiting for API endpoints
6. **Password Policy**: Enforce strong password requirements

## Streaming from Local Server

The platform supports streaming from a local server/machine:

1. Configure the video file path in the Video entity
2. Ensure the backend has access to the video files
3. Use the `/api/videos/stream/{id}` endpoint for streaming
4. The system supports chunked streaming for large files

## Database Schema

### Main Entities

- **User**: User accounts with roles
- **Video**: Video metadata and file references
- **VideoAccess**: Track student video access
- **AccessLog**: User access history
- **ChatMessage**: Chat messages between users

## Development

### Running Tests

Backend:
```bash
cd backend
mvn test
```

Frontend:
```bash
cd frontend
npm test
```

### Building for Production

Backend:
```bash
cd backend
mvn clean package -DskipTests
```

Frontend:
```bash
cd frontend
npm run build --prod
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Ensure PostgreSQL is running
   - Check database credentials in application.yml

2. **CORS Error**
   - Verify CORS configuration in SecurityConfig
   - Check allowed origins match your frontend URL

3. **File Upload Error**
   - Check file size limits in application.yml
   - Verify uploads directory exists and has write permissions

4. **WebSocket Connection Error**
   - Ensure backend is running
   - Check firewall settings
   - Verify WebSocket endpoint configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please use the integrated chat system or contact the development team.

## Roadmap

- [ ] Video analytics dashboard
- [ ] Multiple video quality options
- [ ] Video transcoding
- [ ] Mobile applications
- [ ] Advanced search and filtering
- [ ] Course management system
- [ ] Certificate generation
- [ ] Payment integration

---

Developed with ❤️ for CPMA educational platform
