"""Authenticated transport for the isolated liquid prototype; no engineering math."""
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import Field, ValidationError

from backend.auth import get_current_user_id
from engineering import control_valve as engine


class PrototypeRoute(APIRoute):
    """Keep invalid numeric inputs and exception contexts out of JSON errors.

    Scoped to this router: existing API error/auth/CORS behavior is unchanged.
    FastAPI's default validation body can echo NaN/Infinity, which JSON forbids.
    """
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def handle(request):
            try:
                return await handler(request)
            except RequestValidationError as exc:
                return JSONResponse(status_code=422, content={"detail": [
                    {"loc": list(error['loc']), "msg": error['msg'], "type": error['type']}
                    for error in exc.errors()
                ]})
        return handle


router = APIRouter(prefix="/control-valves", tags=["Control valves (prototype)"],
                   route_class=PrototypeRoute)


class LiquidSizingRequest(engine.Model):
    """Only supported inputs; nested engine schemas retain strict field validation."""
    normal: engine.OperatingCase
    minimum: engine.OperatingCase | None = None
    maximum: engine.OperatingCase | None = None
    rating_margin: Annotated[float, Field(ge=0)] = 0.10
    display_basis: Literal['Cv', 'Kv', 'both'] = 'both'

    def to_engine(self) -> engine.SizingRequest:
        return engine.SizingRequest(
            schema_version=self.schema_version, normal=self.normal,
            minimum=self.minimum, maximum=self.maximum,
            rating_margin=self.rating_margin, display_basis=self.display_basis,
        )


EXAMPLE = {
    'schema_version': 'control-valve-liquid/1',
    'normal': {
        'case_id': 'normal', 'enabled': True, 'flow_value': 10.0, 'flow_unit': 'm³/h',
        'upstream_pressure': 3.54, 'downstream_pressure': 2.0, 'pressure_unit': 'bar',
        'pressure_basis': 'absolute', 'temperature': 20.0, 'temperature_unit': 'C',
        'fluid_config': {
            'fluid': 'Water', 'phase_type': 'Liquid', 'composition': 'pure',
            'rheology': 'Newtonian', 'use_manual_properties': False,
        },
        'upstream_pipe_id_m': 0.05,
    },
    'rating_margin': 0.10, 'display_basis': 'both',
}


@router.post(
    '/liquid/size', response_model=engine.SizingResult,
    summary='Prototype liquid control-valve base sizing (authenticated)',
    description=(
        'Prototype-only, pure Newtonian liquid-only, turbulent non-choked base sizing. '
        'Not verified against the complete IEC/ISA standard. Not for final design, '
        'procurement or safety-critical decisions. Manufacturer confirmation required. '
        'Returns prototype_correlated and final_selection_allowed=false. '
        'No choking, viscosity or attached-fitting corrections; pipe Reynolds is screening only. '
        'Normal case is mandatory; minimum and maximum are optional. Gauge pressures '
        'require atmospheric_pressure_pa. Manual properties require traceable manual_source '
        'at the actual inlet pressure and temperature. No data is persisted.'
    ),
    responses={401: {'description': 'Missing or invalid session'},
               422: {'description': 'Invalid input, unsupported service or unavailable liquid properties'},
               503: {'description': 'Existing authentication provider unavailable or unconfigured'},
               500: {'description': 'Unexpected internal error'}},
)
def size_liquid(
    request: Annotated[LiquidSizingRequest, Body(openapi_examples={
        'water': {'summary': 'Pure water with automatic properties at real inlet conditions', 'value': EXAMPLE},
    })],
    user_id: UUID = Depends(get_current_user_id),
) -> engine.SizingResult:
    try:
        mapped = request.to_engine()
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=[
            {'loc': ['body', *error['loc']], 'msg': error['msg'], 'type': error['type']}
            for error in exc.errors(include_input=False, include_context=False)
        ]) from exc
    try:
        return engine.size_control_valve(mapped)
    except ValueError as exc:
        # Preserve engine case context without echoing property inputs or exception ctx.
        case_id = str(exc).partition(':')[0]
        location = ['body'] + ([case_id] if case_id in ('normal', 'minimum', 'maximum') else [])
        if isinstance(exc.__cause__, ValidationError):
            fields = {
                'flow_m3_s': 'flow_value', 'upstream_pressure_pa_abs': 'upstream_pressure',
                'downstream_pressure_pa_abs': 'downstream_pressure',
                'differential_pressure_pa': 'downstream_pressure', 'temperature_k': 'temperature',
            }
            detail = [
                {'loc': location + [fields.get(part, part) for part in error['loc']],
                 'msg': error['msg'], 'type': error['type']}
                for error in exc.__cause__.errors(include_input=False, include_context=False)
            ]
        else:
            detail = [{'loc': location, 'msg': str(exc), 'type': 'value_error'}]
        raise HTTPException(status_code=422, detail=detail) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Control-valve prototype calculation failed.') from exc
