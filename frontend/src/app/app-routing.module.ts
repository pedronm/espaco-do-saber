import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './auth/components/login.component';
import { RegisterComponent } from './auth/components/register.component';
import { RequestPasswordResetComponent } from './auth/components/request-password-reset.component';
import { ResetPasswordComponent } from './auth/components/reset-password.component';
import { InvalidLinkComponent } from './auth/components/invalid-link.component';
import { NotFoundComponent } from './auth/components/not-found.component';
import { TeacherDashboardComponent } from './teacher/components/teacher-dashboard.component';
import { StudentDashboardComponent } from './student/components/student-dashboard.component';
import { AdminDashboardComponent } from './admin/components/admin-dashboard.component';
import { HomeComponent } from './pages/home-component/home.component'
import { VideoPlayerComponent } from './shared/components/video-player.component';
import { AuthGuard } from './shared/guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [AuthGuard], data: { guestOnly: true } },
  { path: 'cadastro', component: RegisterComponent, canActivate: [AuthGuard], data: { guestOnly: true } },
  { path: 'recuperar-senha', component: RequestPasswordResetComponent, canActivate: [AuthGuard], data: { guestOnly: true } },
  { path: 'reset-senha', component: ResetPasswordComponent },
  { path: 'link-invalido', component: InvalidLinkComponent },
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
    data: { roles: ['aluno', 'medium', 'administrador', 'professor'] }
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
    data: { roles: ['aluno', 'medium', 'administrador', 'professor'] }
  },
  {
    path: 'medium',
    redirectTo: '/aluno',
    pathMatch: 'full'
  },
  { 
    path: 'videos/:id', 
    component: VideoPlayerComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'videos/ao-vivo/:liveId',
    component: VideoPlayerComponent,
    canActivate: [AuthGuard]
  },
  { path: 'entrar', redirectTo: '/login', pathMatch: 'full' },
  { path: 'register', redirectTo: '/cadastro', pathMatch: 'full' },
  { path: 'inicio', redirectTo: '/home', pathMatch: 'full' },
  { path: 'video/:id', redirectTo: '/videos/:id', pathMatch: 'full' },
  { path: 'video/live/:liveId', redirectTo: '/videos/ao-vivo/:liveId', pathMatch: 'full' },
  {
    path: '404',
    component: NotFoundComponent
  },
  {
    path: '**',
    redirectTo: '/404'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
