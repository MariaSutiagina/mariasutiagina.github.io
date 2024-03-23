import requests
from bs4 import BeautifulSoup
from bs4.element import NavigableString
import json
import re

attribute_map = {
    "Год ввода в эксплуатацию": "build_year",
    "Дом признан аварийным": "is_unsafe",
    "Состояние дома": "state",
    "Количество квартир": "apartment_count",
    "Количество балконов": "balcony_count",
    "Класс энергетической эффективности": "energy_class",
    "Количество подъездов": "entrance_count",
    "Наибольшее количество этажей": "max_floors",
    "Наименьшее количество этажей": "min_floors",
    "Формирование фонда кап. ремонта": "repair_fund_source",
    "Площадь парковки м2": "parking_area",
    "Наличие в подъездах приспособлений для нужд маломобильных групп населения": "availability_devices",
    "Тип дома": "house_type",
    "Износ здания, %": "building_wear",
    "Дата, на которую установлен износ здания": "wornout_date",
    "Площадь многоквартирного дома, кв.м": "building_area",
    "Площадь жилых помещений м2": "living_area",
    "Площадь нежилых помещений м2": "nonliving_area",
    "Площадь помещений общего имущества м2": "common_area",
    "Площадь зем. участка общего имущества м2": "earth_area",
    "Серия, тип постройки здания": "project_serial",
    "Статус объекта культурного наследия": "is_heritage",
    "Количество лифтов": "lift_count",
    "Подземных этажей": "underground_floors",
    "Количество лоджий": "loggia_count",
    "Количество нежилых помещений": "nonliving_count",
    "Дата проведения энергетического обследования": "energy_research_date",
    "Основание признания дома аварийным": "unsafe_doc",
    "Дата документа о признании дома аварийным": "unsafe_doc_date",
    "Номер документа о признании дома аварийным": "unsafe_doc_number"
}



def get_house_links(page_url, session):
    """Fetch house links from the base page."""
    print(f"Fetching links from: {page_url}")
    response = session.get(page_url)
    soup = BeautifulSoup(response.content, 'html.parser')
    table = soup.select_one("div.table-responsive:nth-child(11) > table:nth-child(1)")
    if table:
        return [f"https://dom.mingkh.ru{a['href']}" for a in table.find_all('a', href=True)]
    else:
        return None

def parse_house_page(house_url, session):
    """Parse individual house page to get details."""
    print(f"Fetching data from house page: {house_url}")
    id = house_url.split("/")[-1]
    response = session.get(house_url)

    soup = BeautifulSoup(response.content, 'html.parser')
    data_table = soup.select_one("body > div.outer > div.main-block > div.container > div:nth-child(7)") 
    data = {}
    data["id"] = id
    for row in data_table.select("div.col-md-6 > div.table-responsive > table > tr"):
        item = row.select_one("td:nth-child(1)")
        item_name = "".join([t for t in item.contents if type(t)==NavigableString]).strip()
        sup = item.select_one("sup")
        if sup:
            item_name+=sup.get_text()

        item_value = item.select_one("td:nth-child(1)").get_text()
        data[attribute_map[item_name.strip()]] = item_value.strip()

    response = session.get("https://dom.mingkh.ru/api/map/house/"+id)
    jd = response.json()
    print(jd)
    features = jd["features"]
    if features:
        data["geo"] = jd["features"][0]["geometry"]
        data["address"] = jd["features"][0]["properties"]["address"]
        data["region"] = jd["features"][0]["properties"]["region"]
        data["city"] = jd["features"][0]["properties"]["city"]
        data["url"] = jd["features"][0]["properties"]["url"]
    return data

def scrape_site(base_url):
    """Scrape the entire site for house data."""
    houses_data = []
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0"})
    session.headers.update({"X-Requested-With": "XMLHttpRequest"})
    session.headers.update({"Referer": "https://dom.mingkh.ru/moskovskaya-oblast/orehovo-zuevo/718129"})
    places = ['likino-dulevo', 'orehovo-zuevo', 'kurovskoe', 'drezna']

    r = session.get(base_url)
    print(r.cookies.get_dict())
    for place in places:
        page = 1
        place_url = base_url+place+"/"
        while True:
            page_url = f"{place_url}?page={page}"
            house_links = get_house_links(page_url, session)
            if not house_links:
                break  # Exit loop if no more house links
            for house_link in house_links:
                house_data = parse_house_page(house_link, session)
                houses_data.append(house_data)
            page += 1
    return houses_data

base_url = "https://dom.mingkh.ru/moskovskaya-oblast/"
houses_data = scrape_site(base_url)

# Writing the data to a JSON file
with open("houses_data.json", "w", encoding="utf-8") as file:
    json.dump(houses_data, file, ensure_ascii=False, indent=4)

print("Data scraping completed and saved to houses_data.json.")
