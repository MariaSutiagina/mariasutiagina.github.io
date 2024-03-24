// функция, определяющая цвет точки с домом в зависимости от возраста дома
function getColor(age) {
    return age > 100 ? '#800026' : // dark red
           age > 90  ? '#BD0026' : // less dark red
           age > 80  ? '#E31A1C' : // red
           age > 70  ? '#FC4E2A' : // tomato red
           age > 60  ? '#FD8D3C' : // dark orange
           age > 50  ? '#FEB24C' : // orange
           age > 40  ? '#FED976' : // light orange
           age > 30  ? '#FFEDA0' : // very light orange
           age > 20  ? '#FFFFCC' : // almost white
                       '#31a354';   // green
}

// параметры посика по адресу
var searchOptions = {
    keys: ["options.houseData.address"], // Атрибут, по которому осуществляется поиск
    threshold: 0.6 // Порог совпадения адреса
  };
  

// функция поиска адреса
function searchAddress(fuse, map, query) {
    var result = fuse.search(query);
    if (result.length > 0) {
        // если нашли - для первого совпадения - центрируем и масштабируем карту на координаты дома
        var firstMatch = result[0].item;
        map.setView(firstMatch.options.houseData.geo.coordinates, 15);
        // ну и показываем описание
        firstMatch.openPopup();
    } else {
        console.log("No matches found.");
    }
}

// на событие загрузки документа (html) вешаем обработчик - загрузка карты и всё остальное
document.addEventListener('DOMContentLoaded', function() {
    // центрируем и масштабируем карту так чтоб попадал весь город 
    const map = L.map('map').setView([55.8052, 38.9872], 14);

    //  создаем слой с картой из OpenStreetMaps
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 22,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Определяем категории возраста домов
    const ageCategories = [
        {min: 0, max: 10, color: '#0000FF'}, // Blue
        {min: 11, max: 20, color: '#3232FF'},
        {min: 21, max: 30, color: '#6464FF'},
        {min: 31, max: 40, color: '#9696FF'},
        {min: 41, max: 50, color: '#C8C8FF'}, // Light Blue
        {min: 51, max: 60, color: '#FFFF00'}, // Yellow
        {min: 61, max: 70, color: '#FFC800'},
        {min: 71, max: 80, color: '#FF9100'},
        {min: 81, max: 90, color: '#FF5A00'},
        {min: 91, color: '#FF0000'}, // Red for 91+ years
    ];

    // добавляем слой с границей городского округа Орехово-Зуево и городов
    d3.json('assets/oz-okrug.json').then(function(geojsonData) {
        L.geoJson(geojsonData, {
            style: function (feature) {
                if (feature.properties.feature_id == 0) {
                    return {color: "#060", weight: 4, opacity: 0.25};
                } else {
                    return {color: "#007", weight: 2, opacity: 0.35};
                }
            }
        }).addTo(map);
    });

    var houseMarkersLayerGroup = L.layerGroup();

    // загружаем данные о домах и отображаем на карте
    fetch('assets/houses_data.json')
        .then(response => response.json())
        .then(data => {

            // создаем слой с точками, соответствующими домам, который будем отображать
            // в зависимости от состояния чекбокса
            data.forEach(function(house) {
                if ("geo" in house) {
                    const lat = house.geo.coordinates[0];
                    const lng = house.geo.coordinates[1];
                    const buildYear = parseInt(house.build_year, 10);
                    const age = new Date().getFullYear() - buildYear;
                    const address = house.address
                    
                    L.circle([lat, lng], {
                        color: getColor(age),
                        fillColor: getColor(age),
                        fillOpacity: 0.75,
                        radius: 50,
                        houseData: house
                    }).addTo(houseMarkersLayerGroup).bindPopup(`Построен в ${buildYear}, (${age} лет/года)\n${address}`);   
                }
            });    
            

            // создаем слой с тепловой картой
            // для домов каждой возрастной категории - добавляем точки на тепловую карту с соответствующим цветом
            ageCategories.forEach(category => {
                const categoryPoints = data.filter(house => {
                    if (!house.geo || !house.build_year) return false;
                    const age = new Date().getFullYear() - parseInt(house.build_year, 10);
                    return age >= category.min && (category.max ? age <= category.max : true);
                }).map(house => {
                    // For simplicity, this example uses a static value for density/intensity
                    // Ideally, density should be calculated based on the surrounding data points
                    return [house.geo.coordinates[0], house.geo.coordinates[1], 1]; // Using '1' for uniform intensity
                });

                if (categoryPoints.length > 0) {
                    L.heatLayer(categoryPoints, {
                        radius: 25,
                        blur: 15,
                        minOpacity: 0.3,
                        gradient: { 0.5: category.color }
                    }).addTo(map);   
                }


            });        
        });

        // Добавляем легенду (значение цветов для каждой категории)
        var legend = L.control({position: 'bottomright'});

        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'info legend'), // создаем div в документе html
                grades = ageCategories.map(category => category.min), // Определяем мин. возраст категории
                labels = [],
                from, to;

            // Генерим метку и тэг html с соответствующим цветом и текстом
            for (var i = 0; i < grades.length; i++) {
                from = grades[i];
                to = grades[i + 1];

                labels.push(
                    '<i style="background:' + ageCategories[i].color + '"></i> ' +
                    from + (to ? '&ndash;' + to : '+'));
            }

            div.innerHTML = labels.join('<br>'); // добавляем тэги в div
            return div;
        };

        // создаем элементы управления - чекбокс и поле поиска по адресу
        var customControl = L.Control.extend({

            // где будут размещаться элементы управления
            options: {
              position: 'topright'
            },
        
            // обработчик на добавление элемента на форму
            onAdd: function (map) {
              // создаем div  
              var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        
              // запретить передачу событий на карту, когда активны эти элементы управления
              L.DomEvent.disableClickPropagation(container);
        
              // контейнер для чекбокса и его текста
              var checkboxContainer = L.DomUtil.create('div', '', container);
              checkboxContainer.style.marginBottom = '5px'; // Space between checkbox and search input
              checkboxContainer.style.width = '210px';

              // Собсна... чекбоцс
              var checkbox = L.DomUtil.create('input', 'checkbox-control', checkboxContainer);
              checkbox.type = 'checkbox';
              checkbox.id = 'checkbox';
              checkbox.checked = false;
              
              // Текст чекбокса
              var label = L.DomUtil.create('label', '', checkboxContainer);
              label.htmlFor = 'checkbox';
              label.innerText = 'Показать дома';
              label.style.width='100%';
        
              // Поле поиска
              var searchInput = L.DomUtil.create('input', 'search-input', container);
              searchInput.type = 'text';
              searchInput.placeholder = 'Город, улица, дом';
              searchInput.style.display = 'none';
            
              // Кнопка поиска
              var searchButton = L.DomUtil.create('button', 'search-button', container);
              searchButton.innerText = '>>';
              searchButton.style.display = 'none';

              // по нажатию кнопки - запускаем поиск
              searchButton.onclick = function() {
                var address = searchInput.value;
                var fuse = new Fuse(houseMarkersLayerGroup.getLayers(), searchOptions);
                searchAddress(fuse, map, address);
              };

              // обработчик нажатия enter в поле поиска - тоже запускает поиск
              searchInput.addEventListener('keydown', function(event) {
                if (event.key === "Enter") {
                    event.preventDefault(); // Prevent the default form submission
                    searchButton.click(); // Trigger click on searchButton
                }
              });
              
              // если стоит галка в чекбоксе - показываем поле поиска и точки для домов
              checkbox.addEventListener('change', function() {
                if (this.checked) {
                  houseMarkersLayerGroup.addTo(map); // Show marker
                  searchInput.style.display = '';
                  searchButton.style.display = '';                  
                } else {
                  map.removeLayer(houseMarkersLayerGroup); // Hide marker
                  searchInput.style.display = 'none';
                  searchButton.style.display = 'none';                }
              });              
        
              return container;
            }
        });
        
        // добавляем элементы управления на карту
        map.addControl(new customControl());

        // добавляем легенду на карту
        legend.addTo(map);

        
});
