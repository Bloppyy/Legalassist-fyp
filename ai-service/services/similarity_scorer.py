"""
Sentence-transformer-based compliance scoring.

Encodes the submitted document and compares each section against representative
template passages using cosine similarity. Returns a per-section score and
flags sections below the threshold.
"""

from __future__ import annotations

import numpy as np

from models.schemas import SectionScore, SimilarityComplianceResponse
from services.ml_models import get_sentence_model

THRESHOLD = 0.45

# Representative passages for each section of each document type.
# These describe what a compliant section should look like; the scorer measures
# how semantically similar the submitted document's relevant fragment is.
SECTION_TEMPLATES: dict[str, dict[str, str]] = {
    "writ_of_summons": {
        "plaintiff_details": (
            "The Plaintiff is a company incorporated in Malaysia or a citizen of "
            "Malaysia. Plaintiff name, IC number, address and particulars."
        ),
        "defendant_details": (
            "The Defendant is a company or individual. Defendant name, address "
            "and particulars of the defendant."
        ),
        "case_number": (
            "Civil Suit Number case number filed in the High Court of Malaya. "
            "Case No. or Kes No. registered with the court registry."
        ),
        "court_name": (
            "In the High Court of Malaya at Kuala Lumpur. Sessions Court or "
            "Magistrate Court. Mahkamah Tinggi Malaya."
        ),
        "claim_amount": (
            "The Plaintiff claims the sum of Ringgit Malaysia RM being the "
            "total amount owing together with interest."
        ),
        "relief_sought": (
            "The Plaintiff claims the following relief: judgment, declaration, "
            "injunction, damages, order of court."
        ),
        "solicitor_details": (
            "Solicitors for the Plaintiff. Advocates and Solicitors. "
            "Legal firm name, address and contact."
        ),
    },
    "statement_of_claim": {
        "plaintiff_details": (
            "The Plaintiff is a company or individual. Plaintiff name, "
            "registration number, IC number, address."
        ),
        "defendant_details": (
            "The Defendant is a company or individual. Defendant name, "
            "registration number, address, particulars."
        ),
        "background_facts": (
            "On or about the date the Plaintiff and Defendant entered into an "
            "agreement. At all material times the Plaintiff was the owner. "
            "Background facts and circumstances giving rise to the claim."
        ),
        "legal_basis": (
            "The Defendant is in breach of contract, negligent, liable in tort. "
            "Cause of action, breach of duty, liability of the defendant."
        ),
        "relief_sought": (
            "Wherefore the Plaintiff claims judgment, damages, interest, costs "
            "and such other relief as the court deems just."
        ),
        "numbered_paragraphs": (
            "1. The Plaintiff avers that. 2. The Defendant had. "
            "Numbered paragraphs setting out the statement of claim."
        ),
    },
    "affidavit": {
        "deponent_name": (
            "I, the deponent, full name, IC number, make oath and say. "
            "Saya yang bertandatangan di bawah ini."
        ),
        "ic_number": (
            "Identity card number IC number MyKad 123456-78-9012. "
            "No. Kad Pengenalan identity card holder."
        ),
        "sworn_statement": (
            "Make oath and say solemnly affirm and declare. "
            "Bersumpah dan mengatakan mengaku benar."
        ),
        "commissioner_for_oaths": (
            "Sworn before me Commissioner for Oaths. Affirmed before "
            "Pesuruhjaya Sumpah Malaysia."
        ),
        "exhibit_references": (
            "Exhibit A-1 is now shown to me and marked. "
            "Ekshibit A dokumen yang ditanda."
        ),
    },
    "letter_of_demand": {
        "recipient_details": (
            "Dear Sir Madam Mr Ms Encik Puan Tuan. To the addressee. "
            "Kepada penerima surat tuntutan."
        ),
        "our_client_reference": (
            "We act for and on behalf of our client. We are instructed by "
            "anak guam kami to demand."
        ),
        "demand_amount": (
            "The sum of Ringgit Malaysia RM amount owing to our client. "
            "Total outstanding balance due and payable."
        ),
        "payment_deadline": (
            "Within 14 days from the date of this letter. "
            "Before the deadline failing which legal action will be taken."
        ),
        "legal_action_warning": (
            "Legal action will be commenced without further notice. "
            "Court proceedings tindakan undang-undang."
        ),
        "firm_signature_block": (
            "Yours faithfully Yours sincerely. Yang benar. "
            "Advocates and Solicitors firm name."
        ),
    },
    "memorandum_of_appearance": {
        "defendant_name": (
            "The Defendant enters appearance. Defendant name IC number "
            "address for service."
        ),
        "case_number": (
            "Civil Suit Number case number. Case No. filed in the High Court. "
            "Kes No. nombor kes."
        ),
        "solicitor_details": (
            "Solicitors for the Defendant. Peguam bagi defendan. "
            "Advocates and Solicitors firm name address."
        ),
        "address_for_service": (
            "Address for service of the defendant. Alamat untuk servis. "
            "Whose address for service is at."
        ),
    },
    "general": {
        "party_details": (
            "Plaintiff Defendant Claimant Respondent Appellant parties to the "
            "proceedings. Party names and particulars."
        ),
        "date": (
            "Dated this day of month year. Date of the document. "
            "Bertarikh pada hari bulan tahun."
        ),
        "signature_block": (
            "Signed Signature block. Yours faithfully sincerely. "
            "Yang benar ditandatangani."
        ),
    },
}


def _cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    denom = np.linalg.norm(vec_a) * np.linalg.norm(vec_b)
    if denom == 0:
        return 0.0
    return float(np.dot(vec_a, vec_b) / denom)


def check_similarity(content: str, document_type: str) -> SimilarityComplianceResponse:
    """
    Score a submitted document against section templates using sentence-transformer
    cosine similarity. Falls back gracefully if the model is unavailable.
    """
    model = get_sentence_model()

    sections_def = SECTION_TEMPLATES.get(document_type, SECTION_TEMPLATES["general"])
    section_names = list(sections_def.keys())
    template_texts = [sections_def[s] for s in section_names]

    section_scores: list[SectionScore] = []

    if model is None:
        for section in section_names:
            section_scores.append(SectionScore(
                section=section,
                label=section.replace("_", " ").title(),
                score=0.0,
                compliant=False,
            ))
        return SimilarityComplianceResponse(
            document_type=document_type,
            overall_score=0.0,
            compliant=False,
            sections=section_scores,
            threshold=THRESHOLD,
        )

    doc_embedding = model.encode(content, convert_to_numpy=True)
    template_embeddings = model.encode(template_texts, convert_to_numpy=True)

    for i, section in enumerate(section_names):
        score = round(_cosine_similarity(doc_embedding, template_embeddings[i]), 4)
        section_scores.append(SectionScore(
            section=section,
            label=section.replace("_", " ").title(),
            score=score,
            compliant=score >= THRESHOLD,
        ))

    overall = round(float(np.mean([s.score for s in section_scores])), 4)
    compliant = all(s.compliant for s in section_scores)

    return SimilarityComplianceResponse(
        document_type=document_type,
        overall_score=overall,
        compliant=compliant,
        sections=section_scores,
        threshold=THRESHOLD,
    )
