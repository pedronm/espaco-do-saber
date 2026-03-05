# Video Processing Worker (Python)

Worker Python para pipeline de vídeo focado em:

- recebimento de requisições de ingest/processamento;
- persistência de artefatos no Cloudflare R2;
- callbacks para API principal após o processamento.

> Observação: transcode pesado não roda diretamente no Worker. O padrão recomendado é orquestrar jobs externos e usar este worker para controle de fluxo, metadados e upload/armazenamento.

## Endpoints

- `GET /health`
- `POST /jobs`
- `GET /jobs/:id`

## Variáveis

- `APP_ENV`
- `API_BASE_URL` (opcional)
- `API_INTERNAL_TOKEN` (opcional)
