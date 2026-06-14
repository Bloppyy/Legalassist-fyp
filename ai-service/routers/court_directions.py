from fastapi import APIRouter
from models.schemas import DirectionParseRequest, DirectionParseResponse
from services import ml_parser
from services.direction_parser import parse_direction

router = APIRouter(prefix="/parse-direction", tags=["Court Direction Parser"])


@router.post("", response_model=DirectionParseResponse)
def parse_court_direction(request: DirectionParseRequest):
    """
    Parse a Malaysian court direction (arahan) document.

    Tries the fine-tuned transformer model first; falls back to the rule-based
    spaCy parser when the ML model is not available. The parser_used field in
    the response indicates which path ran ('ml' or 'rule_based').
    """
    ml_result = ml_parser.predict(request.text)
    if ml_result is not None:
        return ml_result
    return parse_direction(request.text)
