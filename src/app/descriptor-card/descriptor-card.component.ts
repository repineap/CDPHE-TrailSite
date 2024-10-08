import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-descriptor-card',
  standalone: true,
  imports: [NgIf],
  templateUrl: './descriptor-card.component.html',
  styleUrl: './descriptor-card.component.css'
})
export class DescriptorCardComponent {
  @Input() details: any;
}
