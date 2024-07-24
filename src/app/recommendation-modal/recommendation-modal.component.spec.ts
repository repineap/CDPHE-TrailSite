import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecommendationModalComponent } from './recommendation-modal.component';

describe('RecommendationModalComponent', () => {
  let component: RecommendationModalComponent;
  let fixture: ComponentFixture<RecommendationModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecommendationModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RecommendationModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
