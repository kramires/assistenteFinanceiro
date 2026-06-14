from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str
    openai_model: str = "gpt-4.1"
    openai_model_mini: str = "gpt-4.1-mini"

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"


settings = Settings()
