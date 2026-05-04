from fastapi import APIRouter
from models.schemas import DirectionParseRequest, DirectionParseResponse
from services.direction_parser import parse_direction

router = APIRouter(prefix="/parse-direction", tags=["Court Direction Parser"])


@router.post("", response_model=DirectionParseResponse)
def parse_court_direction(request: DirectionParseRequest):
    """
    Parse a Malaysian court direction (arahan) document.

    Accepts extracted text and returns structured fields:
    - next_court_date: nearest upcoming date found (ISO string)
    - required_actions: list of action sentences extracted
    - parties: plaintiff/defendant names found
    - court_name: issuing court
    - confidence: 0–1 score based on how much was extracted
    """
    return parse_direction(request.text)
