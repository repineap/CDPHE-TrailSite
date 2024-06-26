import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MapComponent } from './map/map.component';
import { ShapeService } from './shape.service';
import { MarkerService } from './marker.service';
import { PopupService } from './popup.service';
import { HttpClientModule } from '@angular/common/http';
import { AutocompleteLibModule } from 'angular-ng-autocomplete';


@Component({
    selector: 'app-root',
    standalone: true,
    providers: [ShapeService, MarkerService, PopupService],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    imports: [RouterOutlet, MapComponent, HttpClientModule, AutocompleteLibModule]
})

export class AppComponent {
  title = 'InternshipWebsite';

  data = [
    {
      id: 1,
      name: 'Georgia'
    },
     {
       id: 2,
       name: 'Usa'
     },
     {
       id: 3,
       name: 'England'
     },
     {
      id: 1,
      name: 'Georgia'
    },
     {
       id: 2,
       name: 'Usa'
     },
     {
       id: 3,
       name: 'England'
     }
  ];
  keyword = 'name';

  selectEvent($event: any) {
    console.log($event);
  }
}
