CREATE TABLE IF NOT EXISTS users (
	id BIGSERIAL PRIMARY KEY,
	username VARCHAR(255) NOT NULL UNIQUE,
	email VARCHAR(255) NOT NULL UNIQUE,
	password VARCHAR(255) NOT NULL,
	full_name VARCHAR(255) NOT NULL,
	role VARCHAR(20) NOT NULL,
	active BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMP NOT NULL DEFAULT NOW(),
	last_access TIMESTAMP NULL
);

INSERT INTO users (username, email, password, full_name, role, active)
VALUES
	('admin', 'admin@espacodosaber.com', '$2b$12$AMwPcBY0YmiAB0pAY0HR1.d85sj7Q2Zpc3lB30GVv6cND39E/0Bdq', 'Admin User', 'ADMIN', TRUE),
	('teacher', 'teacher@espacodosaber.com', '$2b$12$nxiaySlWJp0YAWERAWZVFOmaM0HHQ91pGsQVyTFX/fgAIiI0wMONS', 'Joao Professor', 'TEACHER', TRUE),
	('aluno', 'aluno@espacodosaber.com', '$2b$12$zXG9dW7gxNia3DviuHV0uOM.q4NJ.TSZcZLl19h7hTLp8TyOeks/e', 'Maria Aluno', 'STUDENT', TRUE),
	('aluno2', 'aluno2@espacodosaber.com', '$2b$12$zXG9dW7gxNia3DviuHV0uOM.q4NJ.TSZcZLl19h7hTLp8TyOeks/e', 'Ana Aluno', 'STUDENT', TRUE),
	('aluno3', 'aluno3@espacodosaber.com', '$2b$12$zXG9dW7gxNia3DviuHV0uOM.q4NJ.TSZcZLl19h7hTLp8TyOeks/e', 'Bruno Aluno', 'STUDENT', TRUE),
	('aluno4', 'aluno4@espacodosaber.com', '$2b$12$zXG9dW7gxNia3DviuHV0uOM.q4NJ.TSZcZLl19h7hTLp8TyOeks/e', 'Carla Aluno', 'STUDENT', TRUE),
	('aluno5', 'aluno5@espacodosaber.com', '$2b$12$zXG9dW7gxNia3DviuHV0uOM.q4NJ.TSZcZLl19h7hTLp8TyOeks/e', 'Diego Aluno', 'STUDENT', TRUE),
	('aluno6', 'aluno6@espacodosaber.com', '$2b$12$zXG9dW7gxNia3DviuHV0uOM.q4NJ.TSZcZLl19h7hTLp8TyOeks/e', 'Elisa Aluno', 'STUDENT', TRUE)
ON CONFLICT (username) DO NOTHING;