import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './auth/components/login.component';
import { RegisterComponent } from './auth/components/register.component';
import { TeacherDashboardComponent } from './teacher/components/teacher-dashboard.component';
import { StudentDashboardComponent } from './student/components/student-dashboard.component';
import { AdminDashboardComponent } from './admin/components/admin-dashboard.component';
import { HomeComponent } from './pages/home-component/home.component'
import { AuthGuard } from './shared/guards/auth.guard';

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
    canActivate: [AuthGuard]
  },
  { 
    path: 'student', 
    component: StudentDashboardComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'admin', 
    component: AdminDashboardComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'videos', 
    component: StudentDashboardComponent,
    canActivate: [AuthGuard]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
