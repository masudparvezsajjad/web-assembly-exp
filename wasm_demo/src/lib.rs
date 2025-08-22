// #[no_mangle]                // so function name is not mangled
#[unsafe(no_mangle)]                // so function name is not mangled
pub extern "C" fn add(a: i32, b: i32) -> i32 {
    a + b
}
