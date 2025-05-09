import React, { useState, useEffect, useRef } from 'react';
import { Layout, Typography, Button, Card, Upload, Input, Select, Modal, message } from 'antd';
import {
  LogoutOutlined,
  SoundOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  UploadOutlined
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import { jwtDecode } from 'jwt-decode';
import { useAuth } from './KeycloakAuthProvider';

const { Header, Footer, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Theme colors
const PRIMARY_COLOR = '#5c068c';
const PRIMARY_DARK = '#450669';
const PRIMARY_LIGHT = '#7109aa';
const SECONDARY_COLOR = '#f0f2f5';
const TEXT_LIGHT = '#ffffff';
const TEXT_SECONDARY = '#e0c2f2';

// Gradient colors
const GRADIENT_PRIMARY = `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, #8a0fcc 100%)`;
const GRADIENT_HEADER = `linear-gradient(90deg, ${PRIMARY_COLOR} 0%, #7a0db8 60%, #9112d7 100%)`;
const GRADIENT_CARD = `linear-gradient(135deg, ${PRIMARY_LIGHT} 0%, #8a0fd3 100%)`;
const GRADIENT_BUTTON = `linear-gradient(to right, ${PRIMARY_COLOR} 0%, #7a0db8 100%)`;
const GRADIENT_FOOTER = `linear-gradient(90deg, ${PRIMARY_DARK} 0%, ${PRIMARY_COLOR} 50%, #7a0db8 100%)`;
const GRADIENT_SIDEBAR = `linear-gradient(180deg, #f8f2fc 0%, #f1e3fa 100%)`;

interface UserInfo {
  firstname: string;
  lastname: string;
}

interface ExtendedFile extends File {
  uid?: string;
}

interface AudioFile {
  _id: string;
  fileId: string;
  fileName: string;
  originalFilename: string;
  title: string;
  description: string;
  category: string;
  size: number;
  mimeType: string;
  userId: string;
  createdAt: string;
  __v: number;
}

const AudioFileHostingApp: React.FC = () => {
  // State management
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    category: '',
  });
  const [selectedFile, setSelectedFile] = useState<ExtendedFile | null>(null);

  // Create a ref for the audio player
  const audioPlayerRef = useRef<any>(null);

  const { logout } = useAuth();

  // Fetch user info from JWT token on mount
  useEffect(() => {
    const token = localStorage.getItem('kc_id_token');
    if (token) {
      try {
        const decodedToken: any = jwtDecode(token);
        setUserInfo({
          firstname: decodedToken.given_name || 'User',
          lastname: decodedToken.family_name || '',
        });
      } catch (error) {
        console.error('Error decoding token:', error);
        setUserInfo({ firstname: 'User', lastname: '' });
      }
    }
  }, []);

  // Fetch audio files on mount
  useEffect(() => {
    fetchAudioFiles();
  }, []);

  const fetchAudioFiles = async () => {
    // Placeholder for API call
    try {
      // In a real app, replace with actual API call
      const response = await fetch('http://localhost:5000/file', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`
        }
      });
      const data = await response.json();
      setAudioFiles(data);
    } catch (error) {
      console.error('Error fetching audio files:', error);
      message.error('Failed to load audio files');
    }
  };

  const handleFileSelect: UploadProps['onChange'] = (info) => {
    if (info.fileList && info.fileList.length > 0) {
      // Get the last file in the list (most recently added)
      const fileInfo = info.fileList[info.fileList.length - 1];

      // Set the file info
      setSelectedFile(fileInfo.originFileObj || {
        name: fileInfo.name,
        size: fileInfo.size,
        type: fileInfo.type
      } as File);

      // Set title default to filename without extension
      const fileName = fileInfo.name.split('.').slice(0, -1).join('.');
      setUploadForm(prev => ({ ...prev, title: fileName }));
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setUploadForm(prev => ({ ...prev, [field]: value }));
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      message.error('Please select a file to upload');
      return;
    }

    if (!uploadForm.title) {
      message.error('Please enter a title for the audio file');
      return;
    }

    if (!uploadForm.category) {
      message.error('Please select a category');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', uploadForm.title);
    formData.append('description', uploadForm.description);
    formData.append('category', uploadForm.category);

    await fetch('http://localhost:5000/file/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`
      },
      body: formData
    });

    message.success(`${uploadForm.title} uploaded successfully!`);

    // Reset form
    setSelectedFile(null);
    setUploadForm({
      title: '',
      description: '',
      category: '',
    });

    // Refresh audio files list
    fetchAudioFiles();
  };

  const stopAudioPlayback = () => {
    // Access the audio player instance through the ref and pause it
    if (audioPlayerRef.current) {
      const audioElement = audioPlayerRef.current.audio.current;
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    }
    // Also clear the current audio source
    setCurrentAudio(null);
  };

  const deleteAudioFile = async (fileId: string) => {
    try {
      await fetch(`http://localhost:5000/file/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`
        }
      });

      message.success('Audio file deleted successfully');

      // If the current playing audio is deleted, stop playback completely
      const deletedFile = audioFiles.find(file => file.fileId === fileId);
      if (deletedFile && currentAudio === `http://localhost:9000/audio/${deletedFile.fileName}`) {
        stopAudioPlayback();
      }
      fetchAudioFiles();
    } catch (error) {
      console.error('Error deleting audio file:', error);
      message.error('Failed to delete audio file');
    }
  };

  const playAudio = (url: string) => {
    setCurrentAudio(url);
  };

  const showLogoutModal = () => {
    setIsModalOpen(true);
  };

  const handleLogout = () => {
    // Stop any playing audio before logout
    stopAudioPlayback();
    // Logout
    logout();
    setIsModalOpen(false);
  };

  const musicGenres = [
    'Rock', 'Pop', 'Hip Hop', 'R&B', 'Country',
    'Electronic', 'Jazz', 'Classical', 'Blues',
    'Reggae', 'Folk', 'Metal', 'Punk', 'Soul',
    'Funk', 'Ambient', 'Acoustic', 'World'
  ];

  return (
    <Layout style={{ width: "100vw", minHeight: '100vh' }}>
      <Header style={{ 
        padding: '0 24px', 
        background: GRADIENT_HEADER,
        boxShadow: '0 2px 8px rgba(92, 6, 140, 0.3)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <SoundOutlined style={{ fontSize: '24px', color: TEXT_LIGHT, marginRight: '12px' }} />
          <Title level={4} style={{ margin: 0, color: TEXT_LIGHT }}>Audio File Hosting</Title>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Text style={{ color: TEXT_LIGHT, marginRight: '12px' }}>
            {userInfo ? `${userInfo.firstname} ${userInfo.lastname}` : 'Guest'}
          </Text>
          <Button
            type="text"
            icon={<LogoutOutlined style={{ color: TEXT_LIGHT }} />}
            onClick={showLogoutModal}
          />
        </div>
      </Header>

      <Layout>
        <Sider width={300} theme="light" style={{ padding: '24px', background: GRADIENT_SIDEBAR }}>
          <Title level={4} style={{ color: PRIMARY_COLOR }}>Upload Audio</Title>

          <div style={{ marginBottom: '16px' }}>
            <Upload
              accept=".mp3,.wav,.ogg"
              maxCount={1}
              beforeUpload={() => false}
              onChange={handleFileSelect}
              showUploadList={true}
              fileList={selectedFile ? [{
                uid: selectedFile.uid || '-1',
                name: selectedFile.name,
                status: 'done',
                size: selectedFile.size,
                type: selectedFile.type
              }] : []}
            >
              <Button icon={<UploadOutlined />} style={{ borderColor: PRIMARY_COLOR, color: PRIMARY_COLOR }}>
                Select Audio File
              </Button>
            </Upload>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <Text strong style={{ color: PRIMARY_DARK }}>Title</Text>
            <Input
              placeholder="Audio title"
              value={uploadForm.title}
              onChange={(e) => handleFormChange('title', e.target.value)}
              style={{ borderColor: '#e6d4f0' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <Text strong style={{ color: PRIMARY_DARK }}>Description</Text>
            <TextArea
              rows={4}
              placeholder="Audio description"
              value={uploadForm.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              style={{ borderColor: '#e6d4f0' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <Text strong style={{ color: PRIMARY_DARK }}>Category</Text>
            <Select
              style={{ width: '100%' }}
              placeholder="Select a category"
              value={uploadForm.category || undefined}
              onChange={(value) => handleFormChange('category', value)}
              dropdownStyle={{ borderColor: PRIMARY_LIGHT }}
            >
              {musicGenres.map(genre => (
                <Option key={genre} value={genre}>{genre}</Option>
              ))}
            </Select>
          </div>

          <Button
            type="primary"
            onClick={handleUpload}
            style={{ 
              width: '100%', 
              background: GRADIENT_BUTTON,
              borderColor: PRIMARY_DARK, 
              color: SECONDARY_COLOR,
              boxShadow: '0 2px 5px rgba(92, 6, 140, 0.3)'
            }}
            disabled={!selectedFile || !uploadForm.title || !uploadForm.category}
          >
            Upload
          </Button>
        </Sider>

        <Content style={{ padding: '24px', background: SECONDARY_COLOR }}>
          <Title level={3} style={{ color: PRIMARY_COLOR }}>Your Audio Files</Title>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {audioFiles.map(file => (
              <Card
                key={file.fileId}
                title={file.title}
                actions={[
                  <PlayCircleOutlined key="play" style={{ color: PRIMARY_COLOR, fontSize:"1.5rem" }} onClick={() => playAudio(`http://localhost:9000/audio/${file.fileName}`)} />,
                  <DeleteOutlined key="delete" style={{ color: '#ff4d4f', fontSize:"1.5rem" }} onClick={() => deleteAudioFile(file.fileId)} />
                ]}
                style={{
                  borderColor: '#e6d4f0',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(92, 6, 140, 0.15)'
                }}
                styles={{
                  header: { 
                    background: GRADIENT_CARD, 
                    color: TEXT_LIGHT,
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px'
                  },
                  body: {
                    flex: '1 0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '150px',
                    overflow: 'auto',
                  }
                }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: PRIMARY_DARK }}>Description:</strong>
                  <div style={{ wordBreak: 'break-word' }}>{file.description || 'No description'}</div>
                </div>
                <div>
                  <strong style={{ color: PRIMARY_DARK }}>Category:</strong> {file.category || 'Uncategorized'}
                </div>
              </Card>
            ))}

            {audioFiles.length === 0 && (
              <div style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '48px 0' }}>
                <Text type="secondary" style={{ color: PRIMARY_DARK }}>No audio files found. Upload your first audio file!</Text>
              </div>
            )}
          </div>
        </Content>
      </Layout>

      <Footer style={{ 
        padding: '0', 
        background: GRADIENT_FOOTER, 
        borderTop: `1px solid ${PRIMARY_DARK}`,
        boxShadow: '0 -2px 8px rgba(92, 6, 140, 0.2)'
      }}>
        {currentAudio ? (
          <div style={{ display: 'flex', height: '80px' }}>
            {/* Left side - Audio details */}
            <div style={{ flex: '0 0 50%', padding: '10px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ maxWidth: '90%', overflow: 'hidden' }}>
                  <Title level={5} style={{ color: TEXT_LIGHT, margin: 0, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {audioFiles.find(file => `http://localhost:9000/audio/${file.fileName}` === currentAudio)?.title || 'Unknown Track'}
                  </Title>
                  <Text style={{ color: TEXT_SECONDARY, display: 'block', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    Category: {audioFiles.find(file => `http://localhost:9000/audio/${file.fileName}` === currentAudio)?.category || 'N/A'}
                  </Text>
                  <Text style={{ color: TEXT_SECONDARY, fontSize: '12px', display: 'block', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {audioFiles.find(file => `http://localhost:9000/audio/${file.fileName}` === currentAudio)?.description?.substring(0, 60) || ''}
                  </Text>
                </div>
                <Button
                  type="text"
                  icon={<DeleteOutlined style={{ color: TEXT_LIGHT }} />}
                  onClick={stopAudioPlayback}
                  title="Stop playback"
                />
              </div>
            </div>

            {/* Right side - Audio player - Custom styles for the player will be applied via CSS */}
            <div style={{ flex: '0 0 50%', background: '#f8f2fc' }}>
              <AudioPlayer
                ref={audioPlayerRef}
                src={currentAudio}
                autoPlay
                showJumpControls={true}
                layout="horizontal"
                autoPlayAfterSrcChange={true}
                onEnded={() => console.log('Audio playback ended')}
                customAdditionalControls={[]}
                customVolumeControls={[]}
                style={{ height: '100%' }}
              />
            </div>
          </div>
        ) : (
          <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f2fc' }}>
            <Text style={{ color: PRIMARY_COLOR }}>Select an audio file to play</Text>
          </div>
        )}
      </Footer>

      <Modal
        title="Confirm Logout"
        open={isModalOpen}
        onOk={handleLogout}
        onCancel={() => setIsModalOpen(false)}
        okButtonProps={{ 
          style: { 
            background: GRADIENT_BUTTON, 
            borderColor: PRIMARY_DARK 
          } 
        }}
      >
        <p>Are you sure you want to logout?</p>
      </Modal>

      {/* Add some global styles to customize the AudioPlayer component */}
      <style>{`
        .rhap_container {
          background-color: #f8f2fc !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        
        .rhap_progress-filled {
          background: ${GRADIENT_PRIMARY} !important;
        }
        
        .rhap_progress-indicator {
          background: ${PRIMARY_DARK} !important;
          box-shadow: 0 0 5px rgba(92, 6, 140, 0.5) !important;
        }
        
        .rhap_controls-section .rhap_volume-controls {
          color: ${PRIMARY_COLOR} !important;
        }
        
        .rhap_controls-section .rhap_main-controls button {
          color: ${PRIMARY_COLOR} !important;
          transition: transform 0.2s ease !important;
        }
        
        .rhap_controls-section .rhap_main-controls button:hover {
          transform: scale(1.1) !important;
        }
        
        .rhap_controls-section .rhap_additional-controls button {
          color: ${PRIMARY_COLOR} !important;
        }
        
        .rhap_time {
          color: ${PRIMARY_DARK} !important;
        }
        
        .ant-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease !important;
        }
        
        .ant-card:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 6px 16px rgba(92, 6, 140, 0.25) !important;
        }
        
        .ant-card-actions {
          background: #f8f2fc !important;
        }
        
        .ant-card-actions > li > span {
          transition: transform 0.2s ease !important;
        }
        
        .ant-card-actions > li > span:hover {
          transform: scale(1.2) !important;
        }
        
        .ant-btn-primary {
          transition: all 0.3s ease !important;
        }
        
        .ant-btn-primary:hover:not(:disabled) {
          background: linear-gradient(to right, #7a0db8 0%, ${PRIMARY_COLOR} 100%) !important;
          box-shadow: 0 4px 10px rgba(92, 6, 140, 0.4) !important;
          transform: translateY(-2px) !important;
        }
      `}</style>
    </Layout>
  );
};

export default AudioFileHostingApp;