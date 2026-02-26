import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './auth/components/login.component';
import { RegisterComponent } from './auth/components/register.component';
import { TeacherDashboardComponent } from './teacher/components/teacher-dashboard.component';
import { StudentDashboardComponent } from './student/components/student-dashboard.component';
import { AdminDashboardComponent } from './admin/components/admin-dashboard.component';
import { HomeComponent } from './pages/home-component/home.component'
import { VideoPlayerComponent } from './shared/components/video-player.component';
import { LiveStreamComponent } from './shared/components/live-stream.component';
import { AuthGuard } from './shared/guards/auth.guard';
import { LiveStreamExitGuard } from './shared/guards/live-stream-exit.guard';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: 'home',
    component: HomeComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'teacher', 
    component: TeacherDashboardComponent,
    canActivate: [AuthGuard],
    data: { roles: ['TEACHER', 'ADMIN'] }
  },
  { 
    path: 'student', 
    component: StudentDashboardComponent,
    canActivate: [AuthGuard],
    data: { roles: ['STUDENT', 'ADMIN', 'TEACHER'] }
  },
  { 
    path: 'admin', 
    component: AdminDashboardComponent,
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN'] }
  },
  { 
    path: 'videos', 
    component: StudentDashboardComponent,
    canActivate: [AuthGuard],
    data: { roles: ['STUDENT', 'ADMIN', 'TEACHER'] }
  },
  { 
    path: 'video/:id', 
    component: VideoPlayerComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'video/live/:liveId',
    component: VideoPlayerComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'live',
    component: LiveStreamComponent,
    canActivate: [AuthGuard],
    data: { roles: ['TEACHER', 'ADMIN'] },
    canDeactivate: [LiveStreamExitGuard]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
