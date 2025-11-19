import { useState, useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Heart, MessageCircle, Edit, Trash2, User, PenSquare, LogOut } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthDialog = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : formData;
      
      const response = await axios.post(`${API}${endpoint}`, payload);
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      toast.success(isLogin ? 'Welcome back!' : 'Account created!');
      onSuccess(response.data.user);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="neo-dialog" data-testid="auth-dialog">
        <DialogHeader>
          <DialogTitle className="pixel-title">{isLogin ? 'LOGIN' : 'REGISTER'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="pixel-label">USERNAME</label>
              <Input
                data-testid="register-username-input"
                className="neo-input"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
          )}
          <div>
            <label className="pixel-label">EMAIL</label>
            <Input
              data-testid="login-email-input"
              type="email"
              className="neo-input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="pixel-label">PASSWORD</label>
            <Input
              data-testid="login-password-input"
              type="password"
              className="neo-input"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>
          <Button data-testid="auth-submit-button" type="submit" className="neo-button w-full" disabled={loading}>
            {loading ? 'LOADING...' : isLogin ? 'LOGIN' : 'REGISTER'}
          </Button>
          <p className="text-center pixel-text">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button
              data-testid="toggle-auth-mode-button"
              type="button"
              className="ml-2 pixel-link"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'REGISTER' : 'LOGIN'}
            </button>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ArticleFeed = ({ user }) => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const response = await axios.get(`${API}/articles`);
      setArticles(response.data);
    } catch (error) {
      toast.error('Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return <div className="pixel-text text-center py-20" data-testid="loading-feed">LOADING ARTICLES...</div>;
  }

  return (
    <div className="article-feed" data-testid="article-feed">
      {articles.length === 0 ? (
        <div className="empty-state" data-testid="empty-feed">
          <p className="pixel-text">NO ARTICLES YET</p>
          <p className="pixel-subtext">BE THE FIRST TO WRITE!</p>
        </div>
      ) : (
        articles.map((article) => (
          <div key={article.id} className="article-card" data-testid={`article-card-${article.id}`}>
            <div className="flex items-start gap-4">
              <Avatar className="neo-avatar">
                <AvatarFallback>{article.author_username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Link 
                    to={`/profile/${article.author_username}`} 
                    className="pixel-link"
                    data-testid={`author-link-${article.id}`}
                  >
                    @{article.author_username}
                  </Link>
                  <span className="pixel-date">{formatDate(article.created_at)}</span>
                </div>
                <h2 
                  className="article-title"
                  onClick={() => navigate(`/article/${article.id}`)}
                  data-testid={`article-title-${article.id}`}
                >
                  {article.title}
                </h2>
                <p className="article-preview">
                  {article.content.substring(0, 200)}{article.content.length > 200 ? '...' : ''}
                </p>
                <div className="flex items-center gap-4 mt-3">
                  {article.tags.map((tag, idx) => (
                    <span key={idx} className="pixel-tag" data-testid={`tag-${tag}`}>{tag}</span>
                  ))}
                </div>
                <div className="flex items-center gap-6 mt-4">
                  <span className="pixel-stat" data-testid={`likes-count-${article.id}`}>
                    <Heart className="w-4 h-4" /> {article.likes_count}
                  </span>
                  <span className="pixel-stat" data-testid={`comments-count-${article.id}`}>
                    <MessageCircle className="w-4 h-4" /> {article.comments_count}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const ArticleDetail = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticle();
    fetchComments();
    if (user) checkLiked();
  }, [id, user]);

  const fetchArticle = async () => {
    try {
      const response = await axios.get(`${API}/articles/${id}`);
      setArticle(response.data);
    } catch (error) {
      toast.error('Article not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await axios.get(`${API}/articles/${id}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Failed to load comments');
    }
  };

  const checkLiked = async () => {
    try {
      const response = await axios.get(`${API}/articles/${id}/is-liked`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setIsLiked(response.data.is_liked);
    } catch (error) {
      console.error('Failed to check like status');
    }
  };

  const handleLike = async () => {
    if (!user) {
      toast.error('Please login to like articles');
      return;
    }

    try {
      if (isLiked) {
        await axios.delete(`${API}/articles/${id}/like`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setArticle({ ...article, likes_count: article.likes_count - 1 });
        setIsLiked(false);
      } else {
        await axios.post(`${API}/articles/${id}/like`, {}, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setArticle({ ...article, likes_count: article.likes_count + 1 });
        setIsLiked(true);
      }
    } catch (error) {
      toast.error('Failed to update like');
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to comment');
      return;
    }

    try {
      const response = await axios.post(
        `${API}/articles/${id}/comments`,
        { content: newComment },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setComments([response.data, ...comments]);
      setNewComment('');
      setArticle({ ...article, comments_count: article.comments_count + 1 });
      toast.success('Comment added');
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('DELETE THIS ARTICLE?')) return;

    try {
      await axios.delete(`${API}/articles/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('Article deleted');
      navigate('/');
    } catch (error) {
      toast.error('Failed to delete article');
    }
  };

  if (loading || !article) {
    return <div className="pixel-text text-center py-20" data-testid="loading-article">LOADING...</div>;
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="article-detail" data-testid="article-detail">
      <div className="article-header">
        <h1 className="article-detail-title" data-testid="article-detail-title">{article.title}</h1>
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-3">
            <Avatar className="neo-avatar">
              <AvatarFallback>{article.author_username[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <Link to={`/profile/${article.author_username}`} className="pixel-link" data-testid="article-author-link">
                @{article.author_username}
              </Link>
              <p className="pixel-date">{formatDate(article.created_at)}</p>
            </div>
          </div>
          {user && user.id === article.author_id && (
            <div className="flex gap-2">
              <Button 
                className="neo-button-small"
                onClick={() => navigate(`/write/${article.id}`)}
                data-testid="edit-article-button"
              >
                <Edit className="w-4 h-4" /> EDIT
              </Button>
              <Button 
                className="neo-button-small neo-danger"
                onClick={handleDelete}
                data-testid="delete-article-button"
              >
                <Trash2 className="w-4 h-4" /> DELETE
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="article-content" data-testid="article-content">
        {article.content.split('\n').map((paragraph, idx) => (
          <p key={idx} className="mb-4">{paragraph}</p>
        ))}
      </div>

      <div className="article-actions">
        <Button 
          className={`neo-button-small ${isLiked ? 'neo-liked' : ''}`}
          onClick={handleLike}
          data-testid="like-button"
        >
          <Heart className="w-4 h-4" fill={isLiked ? 'currentColor' : 'none'} /> 
          {article.likes_count} LIKES
        </Button>
      </div>

      <div className="comments-section" data-testid="comments-section">
        <h3 className="pixel-subtitle">COMMENTS ({article.comments_count})</h3>
        
        {user && (
          <form onSubmit={handleComment} className="comment-form">
            <Textarea
              data-testid="comment-input"
              className="neo-textarea"
              placeholder="ADD YOUR COMMENT..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              required
            />
            <Button type="submit" className="neo-button mt-3" data-testid="submit-comment-button">
              POST COMMENT
            </Button>
          </form>
        )}

        <div className="comments-list" data-testid="comments-list">
          {comments.map((comment) => (
            <div key={comment.id} className="comment-card" data-testid={`comment-${comment.id}`}>
              <div className="flex items-start gap-3">
                <Avatar className="neo-avatar-small">
                  <AvatarFallback>{comment.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="pixel-username">@{comment.username}</span>
                    <span className="pixel-date">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="comment-content">{comment.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const WriteArticle = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ title: '', content: '', tags: '', cover_image: '' });
  const [loading, setLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    if (!user) {
      toast.error('Please login to write');
      navigate('/');
      return;
    }

    if (id) {
      setIsEdit(true);
      fetchArticle();
    }
  }, [id, user]);

  const fetchArticle = async () => {
    try {
      const response = await axios.get(`${API}/articles/${id}`);
      const article = response.data;
      setFormData({
        title: article.title,
        content: article.content,
        tags: article.tags.join(', '),
        cover_image: article.cover_image || ''
      });
    } catch (error) {
      toast.error('Failed to load article');
      navigate('/');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        title: formData.title,
        content: formData.content,
        tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
        cover_image: formData.cover_image
      };

      if (isEdit) {
        await axios.put(`${API}/articles/${id}`, payload, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        toast.success('Article updated!');
        navigate(`/article/${id}`);
      } else {
        const response = await axios.post(`${API}/articles`, payload, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        toast.success('Article published!');
        navigate(`/article/${response.data.id}`);
      }
    } catch (error) {
      toast.error('Failed to save article');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="write-article" data-testid="write-article">
      <h1 className="pixel-title mb-8">{isEdit ? 'EDIT ARTICLE' : 'WRITE NEW ARTICLE'}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="pixel-label">TITLE</label>
          <Input
            data-testid="article-title-input"
            className="neo-input"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="YOUR AWESOME TITLE..."
            required
          />
        </div>
        <div>
          <label className="pixel-label">CONTENT</label>
          <Textarea
            data-testid="article-content-input"
            className="neo-textarea-large"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="WRITE YOUR STORY..."
            rows={15}
            required
          />
        </div>
        <div>
          <label className="pixel-label">TAGS (COMMA SEPARATED)</label>
          <Input
            data-testid="article-tags-input"
            className="neo-input"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="TECH, GAMING, RETRO"
          />
        </div>
        <div className="flex gap-4">
          <Button type="submit" className="neo-button" disabled={loading} data-testid="publish-article-button">
            {loading ? 'SAVING...' : isEdit ? 'UPDATE ARTICLE' : 'PUBLISH ARTICLE'}
          </Button>
          <Button 
            type="button" 
            className="neo-button-secondary" 
            onClick={() => navigate('/')}
            data-testid="cancel-write-button"
          >
            CANCEL
          </Button>
        </div>
      </form>
    </div>
  );
};

const UserProfile = ({ currentUser }) => {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API}/users/${username}`);
      setProfile(response.data);
    } catch (error) {
      toast.error('User not found');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="pixel-text text-center py-20" data-testid="loading-profile">LOADING PROFILE...</div>;
  }

  if (!profile) {
    return <div className="pixel-text text-center py-20">USER NOT FOUND</div>;
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="user-profile" data-testid="user-profile">
      <div className="profile-header">
        <Avatar className="neo-avatar-large">
          <AvatarFallback>{profile.user.username[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <h1 className="profile-username" data-testid="profile-username">@{profile.user.username}</h1>
        <p className="profile-bio" data-testid="profile-bio">{profile.user.bio || 'NO BIO YET'}</p>
      </div>

      <div className="profile-articles">
        <h2 className="pixel-subtitle">{profile.articles.length} ARTICLES</h2>
        <div className="article-feed">
          {profile.articles.map((article) => (
            <div key={article.id} className="article-card" data-testid={`profile-article-${article.id}`}>
              <Link to={`/article/${article.id}`}>
                <h3 className="article-title">{article.title}</h3>
                <p className="article-preview">
                  {article.content.substring(0, 150)}{article.content.length > 150 ? '...' : ''}
                </p>
                <div className="flex items-center gap-6 mt-3">
                  <span className="pixel-stat">
                    <Heart className="w-4 h-4" /> {article.likes_count}
                  </span>
                  <span className="pixel-stat">
                    <MessageCircle className="w-4 h-4" /> {article.comments_count}
                  </span>
                  <span className="pixel-date ml-auto">{formatDate(article.created_at)}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Navbar = ({ user, onAuthClick, onLogout }) => {
  const navigate = useNavigate();

  return (
    <nav className="navbar" data-testid="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-logo" data-testid="navbar-logo">
          ANYRITE
        </Link>
        <div className="navbar-actions">
          {user ? (
            <>
              <Button 
                className="neo-button-small"
                onClick={() => navigate('/write')}
                data-testid="write-button"
              >
                <PenSquare className="w-4 h-4" /> WRITE
              </Button>
              <Button 
                className="neo-button-small"
                onClick={() => navigate(`/profile/${user.username}`)}
                data-testid="profile-button"
              >
                <User className="w-4 h-4" /> PROFILE
              </Button>
              <Button 
                className="neo-button-small neo-danger"
                onClick={onLogout}
                data-testid="logout-button"
              >
                <LogOut className="w-4 h-4" /> LOGOUT
              </Button>
            </>
          ) : (
            <Button className="neo-button" onClick={onAuthClick} data-testid="login-nav-button">
              LOGIN / REGISTER
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    toast.success('Logged out!');
  };

  return (
    <div className="App">
      <BrowserRouter>
        <Navbar user={user} onAuthClick={() => setShowAuth(true)} onLogout={handleLogout} />
        <div className="main-container">
          <Routes>
            <Route path="/" element={<ArticleFeed user={user} />} />
            <Route path="/article/:id" element={<ArticleDetail user={user} />} />
            <Route path="/write" element={<WriteArticle user={user} />} />
            <Route path="/write/:id" element={<WriteArticle user={user} />} />
            <Route path="/profile/:username" element={<UserProfile currentUser={user} />} />
          </Routes>
        </div>
      </BrowserRouter>
      <AuthDialog isOpen={showAuth} onClose={() => setShowAuth(false)} onSuccess={setUser} />
    </div>
  );
}

export default App;