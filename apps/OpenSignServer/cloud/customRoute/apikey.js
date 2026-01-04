import generateApiKey from 'generate-api-key';
import Parse from 'parse';
import axios from 'axios';
import { serverAppId, cloudServerUrl } from '../../Utils.js';

const serverUrl = cloudServerUrl;
const appId = serverAppId;

/**
 * API Key generation endpoint
 * POST /api/v1/apikey
 * Body: { action: 'generate' }
 * Headers: X-Parse-Session-Token (required for authentication)
 */
export async function handleApiKey(req, res) {
  try {
    // Verify authentication via Parse session token
    const sessionToken = req.headers['x-parse-session-token'];
    if (!sessionToken) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Session token required. Please log in first.' 
      });
    }

    // Verify the session token by calling Parse REST API
    let userId;
    try {
      const userRes = await axios.get(`${serverUrl}/users/me`, {
        headers: {
          'X-Parse-Application-Id': appId,
          'X-Parse-Session-Token': sessionToken,
        },
      });
      userId = userRes.data?.objectId;
      if (!userId) {
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'Invalid session token. Please log in again.' 
        });
      }
    } catch (authError) {
      console.error('Auth error:', authError.response?.status, authError.response?.data);
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid session token. Please log in again.' 
      });
    }

    // Create user pointer for Parse queries
    const userPointer = { __type: 'Pointer', className: '_User', objectId: userId };

    // Check request body
    const { action } = req.body;
    if (action !== 'generate') {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Invalid action. Use { "action": "generate" }' 
      });
    }

    // Generate a new API key
    const apiKey = generateApiKey({ 
      method: 'base32',
      dashes: true 
    });

    // Check if user already has an API key
    const AppToken = Parse.Object.extend('appToken');
    const tokenQuery = new Parse.Query(AppToken);
    tokenQuery.equalTo('UserId', userPointer);
    const existingToken = await tokenQuery.first({ useMasterKey: true });

    if (existingToken) {
      // Update existing token
      existingToken.set('token', apiKey);
      existingToken.set('updatedAt', new Date());
      await existingToken.save(null, { useMasterKey: true });
    } else {
      // Create new token
      const newToken = new AppToken();
      newToken.set('UserId', userPointer);
      newToken.set('token', apiKey);
      newToken.set('createdAt', new Date());
      newToken.set('updatedAt', new Date());
      
      // Set ACL - user can read/write their own token
      const acl = new Parse.ACL();
      acl.setReadAccess(userId, true);
      acl.setWriteAccess(userId, true);
      newToken.setACL(acl);
      
      await newToken.save(null, { useMasterKey: true });
    }

    // Return the token
    return res.status(200).json({ 
      success: true,
      token: apiKey,
      message: 'API key generated successfully' 
    });

  } catch (error) {
    console.error('Error generating API key:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message || 'Failed to generate API key' 
    });
  }
}

