import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DescriptorCardComponent } from './descriptor-card.component';

describe('DescriptorCardComponent', () => {
  let component: DescriptorCardComponent;
  let fixture: ComponentFixture<DescriptorCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DescriptorCardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DescriptorCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
