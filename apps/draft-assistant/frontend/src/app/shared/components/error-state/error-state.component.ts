import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-error-state',
  templateUrl: './error-state.component.html',
  styleUrl: './error-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule],
})
export class ErrorStateComponent {
  readonly message = input.required<string>();
  readonly retryLabel = input<string>('Retry');
  readonly retry = output<void>();

  protected onRetry(): void {
    this.retry.emit();
  }
}
