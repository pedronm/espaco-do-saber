import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { isFeatureHealthchecksOn } from '../constants/feature-flags';

export interface ServiceHealth {
  service: 'api-worker' | 'video-processing-worker';
  ok: boolean;
  status: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class HealthcheckService {
  constructor(private http: HttpClient) {}

  checkApiWorker(): Observable<ServiceHealth> {
    if (!isFeatureHealthchecksOn()) {
      return of({
        service: 'api-worker',
        ok: true,
        status: 200,
        message: 'Healthcheck desabilitado por feature flag.'
      });
    }

    const url = environment.apiHealthUrl || this.resolveApiHealthFromApiUrl(environment.apiUrl);
    return this.http.get<{ ok?: boolean; service?: string; env?: string }>(url, { observe: 'response' }).pipe(
      map((response) => ({
        service: 'api-worker' as const,
        ok: response.status >= 200 && response.status < 300 && response.body?.ok === true,
        status: response.status,
        message: response.body?.service || 'workers-api'
      })),
      catchError((error) => of({
        service: 'api-worker' as const,
        ok: false,
        status: error?.status || 0,
        message: error?.message || 'Falha ao consultar healthcheck da API.'
      }))
    );
  }

  checkVideoProcessingWorker(): Observable<ServiceHealth> {
    if (!isFeatureHealthchecksOn()) {
      return of({
        service: 'video-processing-worker',
        ok: true,
        status: 200,
        message: 'Healthcheck desabilitado por feature flag.'
      });
    }

    const url = environment.videoProcessingHealthUrl || '';
    if (!url) {
      return of({
        service: 'video-processing-worker',
        ok: false,
        status: 0,
        message: 'URL do healthcheck de video-processing nao configurada.'
      });
    }

    return this.http.get<{ ok?: boolean; service?: string; env?: string }>(url, { observe: 'response' }).pipe(
      map((response) => ({
        service: 'video-processing-worker' as const,
        ok: response.status >= 200 && response.status < 300 && response.body?.ok === true,
        status: response.status,
        message: response.body?.service || 'video-processing-worker'
      })),
      catchError((error) => of({
        service: 'video-processing-worker' as const,
        ok: false,
        status: error?.status || 0,
        message: error?.message || 'Falha ao consultar healthcheck de video-processing.'
      }))
    );
  }

  checkWorkers(): Observable<ServiceHealth[]> {
    return forkJoin([
      this.checkApiWorker(),
      this.checkVideoProcessingWorker()
    ]);
  }

  private resolveApiHealthFromApiUrl(apiUrl: string): string {
    return apiUrl.replace(/\/api\/?$/, '') + '/health';
  }
}
