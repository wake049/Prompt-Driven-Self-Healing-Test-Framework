from dataclasses import dataclass
from typing import Optional, List
from enum import Enum

class TripType(str, Enum):
    ONE_WAY = "one_way"
    ROUND_TRIP = "round_trip"

class PaxType(str, Enum):
    ADULT = "adult"
    CHILD = "child"

class FareType(str, Enum):
    ANY = "any"
    WANA_GET_AWAY = "wanna_get_away"
    ANYTIME = "anytime"
    BUSINESS_SELECT = "business_select"

@dataclass
class FlightSegment:
    origin: str
    destination: str
    date: Optional[str] = None  # ISO yyyy-mm-dd

@dataclass
class Itinerary:
    trip_type: TripType
    segments: List[FlightSegment]
    pax_adults: int = 1
    pax_children: int = 0
    fare_type: FareType = FareType.ANY
