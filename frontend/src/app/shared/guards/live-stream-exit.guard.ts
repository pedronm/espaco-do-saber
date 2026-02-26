import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { LiveStreamComponent } from '../components/live-stream.component';

@Injectable({
  providedIn: 'root'
})
export class LiveStreamExitGuard implements CanDeactivate<LiveStreamComponent> {
  canDeactivate(component: LiveStreamComponent): boolean {
    return component.confirmStopOnLeave();
  }
}
