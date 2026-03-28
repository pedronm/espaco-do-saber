import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './auth/components/login.component';
import { RegisterComponent } from './auth/components/register.component';
import { RequestPasswordResetComponent } from './auth/components/request-password-reset.component';
import { ResetPasswordComponent } from './auth/components/reset-password.component';
import { InvalidLinkComponent } from './auth/components/invalid-link.component';
import { NotFoundComponent } from './auth/components/not-found.component';
import { TeacherDashboardComponent } from './teacher/components/teacher-dashboard.component';
import { StudentDashboardComponent } from './student/components/student-dashboard.component';
import { AdminDashboardComponent } from './admin/components/admin-dashboard.component';
import { VideoPlayerComponent } from './shared/components/video-player.component';
import { VideoGridComponent } from './shared/components/video-grid.component';
import { JwtInterceptor } from './shared/services/jwt.interceptor';
import { CommonModule } from '@angular/common';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    RegisterComponent,
    RequestPasswordResetComponent,
    ResetPasswordComponent,
    InvalidLinkComponent,
    NotFoundComponent,
    TeacherDashboardComponent,
    StudentDashboardComponent,
    AdminDashboardComponent,
    VideoPlayerComponent,
    VideoGridComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    CommonModule
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
