function mostrarSeccion(nombre) {

    const secciones = document.querySelectorAll(".seccion");

    secciones.forEach(seccion => {
        seccion.classList.remove("activa");
    });

    const seleccionada = document.getElementById(nombre);

    if (seleccionada) {
        seleccionada.classList.add("activa");
    }
}


function abrirLogin() {

    document.getElementById("modalLogin").style.display = "flex";
}


function cerrarLogin() {

    document.getElementById("modalLogin").style.display = "none";
}


async function llamarFuncion(endpoint) {

    try {

        const respuesta = await fetch(endpoint);

        const mensaje = await respuesta.text();

        alert(mensaje);

    } catch (error) {

        alert("No se pudo conectar con el servidor.");

        console.error(error);
    }
}

async function iniciarSesion(event) {

    event.preventDefault();

    try {

        const respuesta = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const mensaje = await respuesta.text();

        alert(mensaje);

        cerrarLogin();

    } catch (error) {

        alert("No se pudo conectar con el servidor.");

        console.error(error);
    }
}


function cerrarSesion() {

    llamarFuncion("/api/logout");
}