import { Component, AfterViewInit } from '@angular/core';
import jsonData from '../../assets/data/Trailheads_COTREX.json'
import { NgFor, SlicePipe } from '@angular/common';

@Component({
    selector: 'app-sideBar',
    standalone: true,
    imports: [NgFor],
    templateUrl: './sideBar.component.html',
    styleUrl: './sideBar.component.css'
  })

  export class sideBarComponent {
   trailHeads: any[] = jsonData.features

  }