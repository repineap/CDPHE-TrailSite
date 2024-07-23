import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RecommendationQuery } from '../geojson-typing';

@Component({
  selector: 'app-recommendation-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './recommendation-modal.component.html',
  styleUrl: './recommendation-modal.component.css'
})
export class RecommendationModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() search = new EventEmitter<RecommendationQuery>();

  searchQuery: RecommendationQuery = {
    aqiLevels: {
      "#Good": false,
      "#Moderate": false,
      "#UnhealthySG": false,
      "#Unhealthy": false,
      "#VeryUnhealthy": false,
      "#Hazardous": false
    },
    trailsToRecommend: 50,
    maxDistanceMi: 50
  }

  closeModal() {
    this.close.emit();
  }

  performSearch() {
    this.search.emit(this.searchQuery);
  }
}
