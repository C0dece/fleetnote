//! Локальный сервер, который ловит редирект OAuth.
//!
//! Так вход выглядит как в обычных приложениях: пользователь нажимает кнопку,
//! подтверждает доступ в браузере и возвращается в приложение — без копирования кода.

use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[derive(Default)]
pub struct OAuthState {
    listener: Mutex<Option<TcpListener>>,
}

/// Занимает свободный порт на localhost и сообщает его фронтенду,
/// чтобы тот собрал redirect_uri до открытия браузера.
#[tauri::command]
pub fn oauth_start(state: tauri::State<'_, OAuthState>) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;
    *state.listener.lock().map_err(|_| "состояние занято")? = Some(listener);
    Ok(port)
}

/// Ждёт единственный запрос от браузера и возвращает код авторизации.
#[tauri::command]
pub async fn oauth_wait(
    state: tauri::State<'_, OAuthState>,
    timeout_secs: u64,
) -> Result<String, String> {
    let listener = {
        let mut guard = state.listener.lock().map_err(|_| "состояние занято")?;
        guard.take().ok_or("Сервер авторизации не запущен")?
    };

    tauri::async_runtime::spawn_blocking(move || accept_code(listener, timeout_secs))
        .await
        .map_err(|error| error.to_string())?
}

/// Освобождает порт, если пользователь передумал.
#[tauri::command]
pub fn oauth_cancel(state: tauri::State<'_, OAuthState>) -> Result<(), String> {
    let mut guard = state.listener.lock().map_err(|_| "состояние занято")?;
    guard.take();
    Ok(())
}

fn accept_code(listener: TcpListener, timeout_secs: u64) -> Result<String, String> {
    let deadline = Instant::now() + Duration::from_secs(timeout_secs.max(5));

    loop {
        match listener.accept() {
            Ok((stream, _)) => return handle_request(stream),
            Err(ref error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() > deadline {
                    return Err("Время ожидания входа истекло".into());
                }
                std::thread::sleep(Duration::from_millis(120));
            }
            Err(error) => return Err(error.to_string()),
        }
    }
}

fn handle_request(mut stream: TcpStream) -> Result<String, String> {
    stream
        .set_read_timeout(Some(Duration::from_secs(10)))
        .map_err(|error| error.to_string())?;

    let mut reader = BufReader::new(stream.try_clone().map_err(|error| error.to_string())?);
    let mut request_line = String::new();
    reader
        .read_line(&mut request_line)
        .map_err(|error| error.to_string())?;

    let target = request_line.split_whitespace().nth(1).unwrap_or("/");
    let query = target.split_once('?').map(|(_, rest)| rest).unwrap_or("");
    let code = param(query, "code");
    let error = param(query, "error");

    let (title, text) = if code.is_some() {
        ("Готово", "Доступ выдан. Можно вернуться в Fleetnote — окно браузера больше не нужно.")
    } else {
        ("Не получилось", "Доступ не выдан. Вернитесь в Fleetnote и попробуйте ещё раз.")
    };

    let body = format!(
        "<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\"><title>{title}</title>\
<style>body{{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;\
background:#0d0f12;color:#e6e8ec;font-family:system-ui,sans-serif}}\
div{{max-width:420px;padding:28px;border:1px solid rgba(255,255,255,.08);border-radius:16px;text-align:center}}\
h1{{margin:0 0 8px;font-size:20px}}p{{margin:0;color:#9aa1ac;font-size:14px;line-height:1.5}}</style>\
</head><body><div><h1>{title}</h1><p>{text}</p></div></body></html>"
    );

    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.as_bytes().len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();

    match (code, error) {
        (Some(code), _) => Ok(code),
        (None, Some(error)) => Err(format!("Google вернул ошибку: {error}")),
        _ => Err("В ответе нет кода авторизации".into()),
    }
}

fn param(query: &str, name: &str) -> Option<String> {
    query.split('&').find_map(|pair| {
        let (key, value) = pair.split_once('=')?;
        if key != name {
            return None;
        }
        Some(percent_decode(value))
    })
}

fn percent_decode(value: &str) -> String {
    let bytes = value.replace('+', " ").into_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(&String::from_utf8_lossy(&bytes[index + 1..index + 3]), 16) {
                out.push(byte);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use std::net::TcpStream;

    /// Браузер приходит с кодом — сервер отдаёт страницу и возвращает код приложению.
    #[test]
    fn принимает_код_из_редиректа() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let port = listener.local_addr().unwrap().port();

        let handle = std::thread::spawn(move || accept_code(listener, 5));

        let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        stream
            .write_all(b"GET /?state=xyz&code=4%2F0Ab_test-code&scope=drive HTTP/1.1\r\nHost: localhost\r\n\r\n")
            .unwrap();

        let mut response = String::new();
        let _ = stream.read_to_string(&mut response);

        assert!(response.starts_with("HTTP/1.1 200 OK"));
        assert!(response.contains("Готово"));
        assert_eq!(handle.join().unwrap().unwrap(), "4/0Ab_test-code");
    }

    #[test]
    fn сообщает_об_отказе_пользователя() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let port = listener.local_addr().unwrap().port();

        let handle = std::thread::spawn(move || accept_code(listener, 5));

        let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        stream
            .write_all(b"GET /?error=access_denied HTTP/1.1\r\nHost: localhost\r\n\r\n")
            .unwrap();
        let mut response = String::new();
        let _ = stream.read_to_string(&mut response);

        assert!(response.contains("Не получилось"));
        let result = handle.join().unwrap();
        assert!(result.unwrap_err().contains("access_denied"));
    }

    #[test]
    fn не_ждёт_вечно() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let error = accept_code(listener, 1).unwrap_err();
        assert!(error.contains("Время ожидания"));
    }

    #[test]
    fn раскодирует_проценты_в_параметрах() {
        assert_eq!(param("code=a%2Fb+c", "code").unwrap(), "a/b c");
        assert_eq!(param("state=1&code=x", "code").unwrap(), "x");
        assert!(param("state=1", "code").is_none());
    }
}
