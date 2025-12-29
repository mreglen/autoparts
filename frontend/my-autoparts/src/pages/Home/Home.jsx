import React from 'react';
import SliderComponent from './Slider/Slider';
import Map from './Map/Map';
import Banner from './Banner/Banner';
import Form from './Form/Form';
import Reviews from './Reviews/Reviews';


function Home() {
    return (
        <div>
            <SliderComponent />
            <Map />
            <Banner bannerImg='/img/Group 9.png' hText='Закажи эвакуатор сейчас' pText='Звоните прямо сейчас' btnText='Заказать' />
            <Form />
            {/* <Reviews /> */}
        </div>
    );
}

export default Home;