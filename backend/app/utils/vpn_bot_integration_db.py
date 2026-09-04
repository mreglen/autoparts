from sqlalchemy.orm import Session

from app.models.site_vpn_bot_integration import SiteVpnBotIntegration

_VPN_BOT_INTEGRATION_ID = 1


def get_or_create_vpn_bot_integration(db: Session) -> SiteVpnBotIntegration:
    row = (
        db.query(SiteVpnBotIntegration)
        .filter(SiteVpnBotIntegration.id == _VPN_BOT_INTEGRATION_ID)
        .first()
    )
    if row is None:
        row = SiteVpnBotIntegration(
            id=_VPN_BOT_INTEGRATION_ID,
            is_enabled=False,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row
