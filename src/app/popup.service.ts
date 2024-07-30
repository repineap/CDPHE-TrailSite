import { Injectable } from '@angular/core';
import { Trail, TrailProperties, WeatherAlertDescription } from './geojson-typing';

@Injectable({
  providedIn: 'root'
})
export class PopupService {

  constructor() { }

  public  parseNWSAlertDescription(description: string): WeatherAlertDescription {
    const issuerEnd = description.indexOf('...');
    const whatStart = description.indexOf('\n\nWHAT...', issuerEnd) + '\n\nWHAT...'.length;
    const whatEnd = description.indexOf('\n\nWHERE...');
    const whereStart = description.indexOf('\n\nWHERE...', whatEnd) + '\n\nWHERE...'.length;
    const whereEnd = description.indexOf('\n\nWHEN...');
    const whenStart = description.indexOf('\n\nWHEN...', whereEnd) + '\n\nWHEN...'.length;
    const whenEnd = description.indexOf('\n\nIMPACTS...');
    const impactsStart = description.indexOf('\n\nIMPACTS...', whenEnd) + '\n\nIMPACTS...'.length;
    const impactsEnd = description.indexOf('\n\nHEALTH INFORMATION...');
    const healthStart = description.indexOf('\n\nHEALTH INFORMATION...', impactsEnd) + '\n\nHEALTH INFORMATION...'.length;
    description = description.replaceAll('\n', ' ');
    return {
      issuer: description.substring(0, issuerEnd),
      what: description.substring(whatStart, whatEnd),
      where: description.substring(whereStart, whereEnd),
      when: description.substring(whenStart, whenEnd),
      impacts: description.substring(impactsStart, impactsEnd),
      healthInformation: description.substring(healthStart)
    }
  }
  
  public generateAlertPopup(parsedDescription: WeatherAlertDescription, countyName: string): HTMLElement {
    const card = document.createElement('div');
  
    const title = document.createElement('h1');
    title.className = 'text-center font-bold text-black';
    title.innerText = countyName;
    card.appendChild(title);
  
    const what = document.createElement('h1');
    what.className = 'text-gray-700 text-center';
    what.innerText = parsedDescription.what;
    card.appendChild(what);
  
    const when = document.createElement('h1');
    when.className = 'text-gray-700';
    when.innerText = parsedDescription.when;
    card.appendChild(when);
  
    // Impacts section
    const impactsSection = document.createElement('div');
    impactsSection.className = 'mt-2';
  
    const impactsButton = document.createElement('button');
    impactsButton.className = 'text-blue-500 hover:text-blue-700';
    impactsButton.innerText = 'Impacts';
    impactsSection.appendChild(impactsButton);
  
    const impactsContent = document.createElement('div');
    impactsContent.className = 'text-gray-700 mt-2 hidden';
    impactsContent.innerText = parsedDescription.impacts;
    impactsSection.appendChild(impactsContent);
  
    impactsButton.addEventListener('click', () => {
      impactsContent.classList.toggle('hidden');
    });
  
    card.appendChild(impactsSection);
  
    // Health Information section
    const healthSection = document.createElement('div');
    healthSection.className = 'mt-2';
  
    const healthButton = document.createElement('button');
    healthButton.className = 'text-blue-500 hover:text-blue-700';
    healthButton.innerText = 'Health Information';
    healthSection.appendChild(healthButton);
  
    const healthContent = document.createElement('div');
    healthContent.className = 'text-gray-700 mt-2 hidden';
    healthContent.innerText = parsedDescription.healthInformation;
    healthSection.appendChild(healthContent);
  
    healthButton.addEventListener('click', () => {
      healthContent.classList.toggle('hidden');
    });
  
    card.appendChild(healthSection);
  
    //Link to Air Quality site
  
    const linkSection = document.createElement('div');
    linkSection.className = 'mt-2';
  
    const summaryLink = document.createElement('a');
    summaryLink.className = 'text-blue-500 hover:text-blue-700 decoration-none italic';
    summaryLink.innerText = 'See More Information';
    summaryLink.href = 'https://www.colorado.gov/airquality/colorado_summary.aspx';
    summaryLink.target = '_blank';
    linkSection.appendChild(summaryLink);
  
    card.appendChild(linkSection);
  
    return card;
  }

  public createTrailPopup(trail: Trail): HTMLElement {
    const card = document.createElement('div');

    //Header section
    const title = document.createElement('h1');
    title.className = 'text-center font-bold text-black';
    title.innerText = trail.properties.name;
    card.appendChild(title);

    const type = document.createElement('h1');
    type.className = 'text-gray-700 text-center';
    type.innerText = trail.properties.type;
    card.appendChild(type);

    // Attributes Section
    const attributesSection = document.createElement('div');
    attributesSection.className = 'mt-2';
  
    const attributesButton = document.createElement('button');
    attributesButton.className = 'text-blue-500 hover:text-blue-700';
    attributesButton.innerText = 'Attributes';
    attributesSection.appendChild(attributesButton);
  
    const attributesContent = document.createElement('div');
    attributesContent.className = 'text-gray-700 mt-2 hidden trail-popup-body';
    attributesContent.innerHTML = `
    <p>Distance (mi): ${trail.properties.length_mi_}</p>
    <p>Energy Miles*: ${roundNumber(getTrailEnergyMiles(trail.properties))}</p>
    <p>Shenandoah Difficulty*: ${roundNumber(getTrailShenandoahDifficulty(trail.properties))}</p>
    <p>Surface: ${checkForEmpty(trail.properties.surface)}</p>
    <p>Max Elevation (ft): ${roundNumber(metersToFt(trail.properties.max_elevat))}</p>
    <p>Min Elevation (ft): ${roundNumber(metersToFt(trail.properties.min_elevat))}</p>
    <p>Oneway: ${checkForEmpty(trail.properties.oneway)}</p>
    <a href="https://www.pigeonforge.com/hike-difficulty/#:~:text=Petzoldt%20recommended%20adding%20two%20energy,formulas%20for%20calculating%20trail%20difficulty"
    target="_blank" class="text-blue-500 hover:text-blue-700 decoration-none italic">*Learn About Trail Difficulty</a>
    `;
    attributesSection.appendChild(attributesContent);
  
    attributesButton.addEventListener('click', () => {
      attributesContent.classList.toggle('hidden');
    });
  
    card.appendChild(attributesSection);

    // Access Section
    const accessSection = document.createElement('div');
    accessSection.className = 'mt-2';
  
    const accessButton = document.createElement('button');
    accessButton.className = 'text-blue-500 hover:text-blue-700';
    accessButton.innerText = 'Access';
    accessSection.appendChild(accessButton);
  
    const accessContent = document.createElement('div');
    accessContent.className = 'text-gray-700 mt-2 hidden trail-popup-body';
    accessContent.innerHTML = `
    <p>ATV: ${checkForEmpty(trail.properties.atv)}</p>
    <p>Motorcycle: ${checkForEmpty(trail.properties.motorcycle)}</p>
    <p>Horse: ${checkForEmpty(trail.properties.horse)}</p>
    <p>Hiking: ${checkForEmpty(trail.properties.hiking)}</p>
    <p>Biking: ${checkForEmpty(trail.properties.bike)}</p>
    <p>Dogs: ${checkForEmpty(trail.properties.dogs)}</p>
    <p>Highway Vehicle: ${checkForEmpty(trail.properties.highway_ve)}</p>
    <p>Off-Highway Vehicle greater than 50 inches wide: ${checkForEmpty(trail.properties.ohv_gt_50)}</p>
    <p>Access: ${checkForEmpty(trail.properties.access)}</p>
    `;
    accessSection.appendChild(accessContent);
  
    accessButton.addEventListener('click', () => {
      accessContent.classList.toggle('hidden');
    });
  
    card.appendChild(accessSection);

    return card;
  }
}

/*
  Calculated based on https://www.pigeonforge.com/hike-difficulty/#:~:text=Petzoldt%20recommended%20adding%20two%20energy,formulas%20for%20calculating%20trail%20difficulty.
*/
function getTrailEnergyMiles(trail: TrailProperties): number {
  return trail.length_mi_ + (metersToFt(trail.max_elevat - trail.min_elevat)) / 500;
}

function getTrailShenandoahDifficulty(trail: TrailProperties): number {
  return Math.sqrt((metersToFt(trail.max_elevat - trail.min_elevat) * 2) * trail.length_mi_);
}

function metersToFt(m: number): number {
  return m * 3.280839895;
}

function checkForEmpty(value: string): string {
  return value === '' ? 'N/A' : value;
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100;
}
