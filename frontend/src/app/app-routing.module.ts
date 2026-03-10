import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './auth/components/login.component';
import { RegisterComponent } from './auth/components/register.component';
import { TeacherDashboardComponent } from './teacher/components/teacher-dashboard.component';
import { StudentDashboardComponent } from './student/components/student-dashboard.component';
import { AdminDashboardComponent } from './admin/components/admin-dashboard.component';
import { HomeComponent } from './pages/home-component/home.component'
import { VideoPlayerComponent } from './shared/components/video-player.component';
import { AuthGuard } from './shared/guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [AuthGuard], data: { guestOnly: true } },
  { path: 'register', component: RegisterComponent, canActivate: [AuthGuard], data: { guestOnly: true } },
  {
    path: 'home',
    component: HomeComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'professor',
    component: TeacherDashboardComponent,
    canActivate: [AuthGuard],
    data: { roles: ['professor', 'administrador'] }
  },
  { 
    path: 'aluno', 
    component: StudentDashboardComponent,
    canActivate: [AuthGuard],
    data: { roles: ['aluno', 'visitante', 'administrador', 'professor'] }
  },
  { 
    path: 'administrador', 
    component: AdminDashboardComponent,
    canActivate: [AuthGuard],
    data: { roles: ['administrador'] }
  },
  { 
    path: 'videos', 
    component: StudentDashboardComponent,
    canActivate: [AuthGuard],
    data: { roles: ['aluno', 'visitante', 'administrador', 'professor'] }
  },
  {
    path: 'visitante',
    redirectTo: '/aluno',
    pathMatch: 'full'
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
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
