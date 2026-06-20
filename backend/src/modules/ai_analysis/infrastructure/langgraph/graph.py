"""ساخت گراف تحلیل تماس با LangGraph."""
from langgraph.graph import END, START, StateGraph

from src.modules.ai_analysis.application.ports import LLMProvider, SpeechToTextProvider
from src.modules.ai_analysis.infrastructure.langgraph.nodes import (
    make_extraction_node,
    make_followup_node,
    make_manager_node,
    make_scoring_node,
    make_stage_node,
    make_transcript_node,
    route_after_transcript,
)
from src.modules.ai_analysis.infrastructure.langgraph.state import CallAnalysisState


def build_call_analysis_graph(llm: LLMProvider, stt: SpeechToTextProvider):
    g = StateGraph(CallAnalysisState)

    g.add_node("transcript", make_transcript_node(stt))
    g.add_node("extract", make_extraction_node(llm))
    g.add_node("score", make_scoring_node(llm))
    g.add_node("stage", make_stage_node(llm))
    g.add_node("followup", make_followup_node(llm))
    g.add_node("manager", make_manager_node(llm))

    g.add_edge(START, "transcript")
    g.add_conditional_edges(
        "transcript",
        route_after_transcript,
        {"continue": "extract", "review": END},
    )
    g.add_edge("extract", "score")
    g.add_edge("score", "stage")
    g.add_edge("stage", "followup")
    g.add_edge("followup", "manager")
    g.add_edge("manager", END)

    return g.compile()
