from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get('SECRET_KEY', 'anyrite-secret-key-pixel-blog-2025')
ALGORITHM = "HS256"

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    bio: Optional[str] = ""
    avatar: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Article(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author_id: str
    author_username: Optional[str] = ""
    title: str
    content: str
    tags: List[str] = []
    cover_image: Optional[str] = ""
    likes_count: int = 0
    comments_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ArticleCreate(BaseModel):
    title: str
    content: str
    tags: List[str] = []
    cover_image: Optional[str] = ""

class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    cover_image: Optional[str] = None

class Comment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    article_id: str
    user_id: str
    username: Optional[str] = ""
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommentCreate(BaseModel):
    content: str

class Like(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    article_id: str
    user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth routes
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"$or": [{"email": user_data.email}, {"username": user_data.username}]}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Create user
    user = User(
        username=user_data.username,
        email=user_data.email
    )
    
    user_dict = user.model_dump()
    user_dict['password_hash'] = hash_password(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Create token
    token = create_access_token({"sub": user.id})
    
    return {
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "bio": user.bio,
            "avatar": user.avatar
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": user['id']})
    
    return {
        "token": token,
        "user": {
            "id": user['id'],
            "username": user['username'],
            "email": user['email'],
            "bio": user.get('bio', ''),
            "avatar": user.get('avatar', '')
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user = Depends(get_current_user)):
    return {
        "id": current_user['id'],
        "username": current_user['username'],
        "email": current_user['email'],
        "bio": current_user.get('bio', ''),
        "avatar": current_user.get('avatar', '')
    }

# Article routes
@api_router.get("/articles")
async def get_articles(tag: Optional[str] = None, author: Optional[str] = None):
    query = {}
    if tag:
        query['tags'] = tag
    if author:
        query['author_username'] = author
    
    articles = await db.articles.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for article in articles:
        if isinstance(article['created_at'], str):
            article['created_at'] = datetime.fromisoformat(article['created_at'])
        if isinstance(article['updated_at'], str):
            article['updated_at'] = datetime.fromisoformat(article['updated_at'])
    
    return articles

@api_router.get("/articles/{article_id}")
async def get_article(article_id: str):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    if isinstance(article['created_at'], str):
        article['created_at'] = datetime.fromisoformat(article['created_at'])
    if isinstance(article['updated_at'], str):
        article['updated_at'] = datetime.fromisoformat(article['updated_at'])
    
    return article

@api_router.post("/articles")
async def create_article(article_data: ArticleCreate, current_user = Depends(get_current_user)):
    article = Article(
        author_id=current_user['id'],
        author_username=current_user['username'],
        title=article_data.title,
        content=article_data.content,
        tags=article_data.tags,
        cover_image=article_data.cover_image
    )
    
    article_dict = article.model_dump()
    article_dict['created_at'] = article_dict['created_at'].isoformat()
    article_dict['updated_at'] = article_dict['updated_at'].isoformat()
    
    await db.articles.insert_one(article_dict)
    
    return article

@api_router.put("/articles/{article_id}")
async def update_article(article_id: str, article_data: ArticleUpdate, current_user = Depends(get_current_user)):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    if article['author_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in article_data.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.articles.update_one({"id": article_id}, {"$set": update_data})
    
    updated_article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if isinstance(updated_article['created_at'], str):
        updated_article['created_at'] = datetime.fromisoformat(updated_article['created_at'])
    if isinstance(updated_article['updated_at'], str):
        updated_article['updated_at'] = datetime.fromisoformat(updated_article['updated_at'])
    
    return updated_article

@api_router.delete("/articles/{article_id}")
async def delete_article(article_id: str, current_user = Depends(get_current_user)):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    if article['author_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.articles.delete_one({"id": article_id})
    await db.comments.delete_many({"article_id": article_id})
    await db.likes.delete_many({"article_id": article_id})
    
    return {"message": "Article deleted"}

# Like routes
@api_router.post("/articles/{article_id}/like")
async def like_article(article_id: str, current_user = Depends(get_current_user)):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    existing_like = await db.likes.find_one({"article_id": article_id, "user_id": current_user['id']}, {"_id": 0})
    if existing_like:
        return {"message": "Already liked"}
    
    like = Like(article_id=article_id, user_id=current_user['id'])
    like_dict = like.model_dump()
    like_dict['created_at'] = like_dict['created_at'].isoformat()
    
    await db.likes.insert_one(like_dict)
    await db.articles.update_one({"id": article_id}, {"$inc": {"likes_count": 1}})
    
    return {"message": "Liked"}

@api_router.delete("/articles/{article_id}/like")
async def unlike_article(article_id: str, current_user = Depends(get_current_user)):
    result = await db.likes.delete_one({"article_id": article_id, "user_id": current_user['id']})
    
    if result.deleted_count > 0:
        await db.articles.update_one({"id": article_id}, {"$inc": {"likes_count": -1}})
        return {"message": "Unliked"}
    
    raise HTTPException(status_code=404, detail="Like not found")

@api_router.get("/articles/{article_id}/is-liked")
async def is_article_liked(article_id: str, current_user = Depends(get_current_user)):
    like = await db.likes.find_one({"article_id": article_id, "user_id": current_user['id']}, {"_id": 0})
    return {"is_liked": like is not None}

# Comment routes
@api_router.get("/articles/{article_id}/comments")
async def get_comments(article_id: str):
    comments = await db.comments.find({"article_id": article_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for comment in comments:
        if isinstance(comment['created_at'], str):
            comment['created_at'] = datetime.fromisoformat(comment['created_at'])
    
    return comments

@api_router.post("/articles/{article_id}/comments")
async def create_comment(article_id: str, comment_data: CommentCreate, current_user = Depends(get_current_user)):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    comment = Comment(
        article_id=article_id,
        user_id=current_user['id'],
        username=current_user['username'],
        content=comment_data.content
    )
    
    comment_dict = comment.model_dump()
    comment_dict['created_at'] = comment_dict['created_at'].isoformat()
    
    await db.comments.insert_one(comment_dict)
    await db.articles.update_one({"id": article_id}, {"$inc": {"comments_count": 1}})
    
    return comment

# User profile routes
@api_router.get("/users/{username}")
async def get_user_profile(username: str):
    user = await db.users.find_one({"username": username}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    articles = await db.articles.find({"author_username": username}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for article in articles:
        if isinstance(article['created_at'], str):
            article['created_at'] = datetime.fromisoformat(article['created_at'])
        if isinstance(article['updated_at'], str):
            article['updated_at'] = datetime.fromisoformat(article['updated_at'])
    
    return {
        "user": user,
        "articles": articles
    }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()