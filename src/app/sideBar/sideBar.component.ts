import { Component, AfterViewInit } from '@angular/core';
import { NgFor, NgIf, SlicePipe } from '@angular/common';
import { ShapeService } from '../shape.service';

@Component({
    selector: 'app-sideBar',
    standalone: true,
    imports: [NgFor, NgIf],
    templateUrl: './sideBar.component.html',
    styleUrl: './sideBar.component.css'
  })

  export class sideBarComponent {

    public trailheadData: any

    constructor(private _shapeService: ShapeService) {
      this._shapeService.getTrailheadShapes().subscribe((trailheadData) => {
        this.trailheadData = trailheadData;
       })
    }

  }