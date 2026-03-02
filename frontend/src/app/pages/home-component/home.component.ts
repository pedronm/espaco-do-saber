import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  constructor(private authService: AuthService) {}

  get isAdmin(): boolean {
    return this.authService.hasRole('ADMIN');
  }

  get isTeacher(): boolean {
    return this.authService.hasRole('TEACHER');
  }

  get isStudent(): boolean {
    return this.authService.hasRole('STUDENT');
  }

}
