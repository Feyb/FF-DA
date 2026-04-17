import { ChangeDetectionStrategy, Component, input, model } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";

export interface SelectOption<T = string> {
  value: T;
  label: string;
}

@Component({
  selector: "app-select-field",
  templateUrl: "./select-field.component.html",
  styleUrl: "./select-field.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatFormFieldModule, MatSelectModule],
})
export class SelectFieldComponent<T = string> {
  readonly label = input.required<string>();
  readonly options = input.required<ReadonlyArray<SelectOption<T>>>();
  readonly value = model.required<T>();
}
