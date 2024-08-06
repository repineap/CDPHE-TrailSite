import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Trailhead } from '../geojson-typing';
import { CommonModule, NgFor, NgIf } from '@angular/common';

@Component({
  selector: 'app-recommendation-sidebar',
  standalone: true,
  imports: [CommonModule, NgFor, NgIf],
  templateUrl: './recommendation-sidebar.component.html',
  styleUrl: './recommendation-sidebar.component.css'
})
export class RecommendationSidebarComponent {
  @Output() trailheadSelected = new EventEmitter<Trailhead>();
  @Input() recommendedTrailheads: Trailhead[] | undefined;
  @Output() closeRecommendations = new EventEmitter<boolean>();
  @Output() openModal = new EventEmitter<Trailhead>();

  update(trailHead: Trailhead) {
    this.trailheadSelected.emit(trailHead);
  }

  clearRecommendations() {
    this.closeRecommendations.emit(false);
  }
}
