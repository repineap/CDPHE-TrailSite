import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecommendationSidebarComponent } from './recommendation-sidebar.component';

describe('RecommendationSidebarComponent', () => {
  let component: RecommendationSidebarComponent;
  let fixture: ComponentFixture<RecommendationSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecommendationSidebarComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RecommendationSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
