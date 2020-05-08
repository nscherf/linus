export default class ColorMaps {
    get() {
        return {
            "Hot iron": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAABCAYAAAC/iqxnAAADSHpUWHRSYXcgcHJvZmlsZSB0eXBlIGV4aWYAAHjarZVrruQoDIX/s4peQvzCsBye0uxglt8HQlXdqr7dUo8mKC/H2OZ8QML4958ZfuCgSzWoeYo5xguHZs1c8JCu+7jv8NvXffD5hPc3e3g8wIMuwV3u1ziOf4HdXh1cj72+24O3EyedQI/AJ6CszKuMfoo8gYRvO533kE+tJX4Zzjln47xMVu9Pn+/qEKMb4gkHHkJy7SvfmeQ+C07dV+TCV8KzSsJVtueHfuEp3TcCPkX/0O9qx0NectyBHsOKHzodO9n3+m2VvlZEfFz49WFrUl+0f9Fv9jTnuEdXNAbIFc+gHkPcT3CEpCq7W0RznIZn3y2jpatcDdQ6hlrDVfGSiaH4JKVOhSaNfW/UUKLyYMedubFsWxLnzE0WAl2NJnuQLB0sWBrICcz8rIV23rzyIVlC5k7wZEIwMH5v4dPwX9tboDnXNCc6gtINmJfgKGORW1d4AQjNo6ltfSnct+vzWGAFBG3LnDDActU7RDV6zS3ZnOWyAFe97vVC3k8ASITchmIwo5WuSGIU6XJmJ4KOCXwKKmdRriBAFow7qmQViYCTeOVGH6fty8a3GdsLQJhEcaDJUgBL1TRivSVMoRJMTM0smluybCVK1GgxRo9rnyourm4e3T159pIkabIUk6eUciqZs2Abs5Bj9pxyzqUgadGCWAX+BYbKVapWq7F6TTXX0jB9mjZrsXlLLbfSuUvHFhB67N5Tz70MGphKQ4eNOHykkUeZmGtTpk6bcfpMM8/ypHaovlP7JPdnanSo8Qa1/PxFDWb3Rwha24ktZiDGSiDuiwAmNC9mVyJVXuQWsyuzBBFjVGkLTqdFDAR1ENukJ7sXud9yC1D3b7nxd+TCQvd/kAsL3Rdyv3L7hlove7uVDWitQmiKHVKw/OaFYlJB9kzddZa8JocaWarYZop3RXVx+TTLI5uMguhYOGqgAeewfcbxgXAl7zCmc4fRNDXmiYXUrS2fYZnwGxmPV865YU+vIUPGVUoa0dFBCjmX0ZHJSdtEZsceaacbCh7IzNOsPgwNc8JL8N0nGqEHMikQrLi9FdTbcpovA8GAHb/4GpDXvMrPItAMv83wE2rk5dPhHy6XAAABhWlDQ1BJQ0MgcHJvZmlsZQAAeJx9kT1Iw0AcxV/TSlVaHOwgIpihOlkQFXGUKhbBQmkrtOpgcumH0KQhSXFxFFwLDn4sVh1cnHV1cBUEwQ8QJ0cnRRcp8X9JoUWMB8f9eHfvcfcOEBoVppqBcUDVLCOdiIu5/IoYfEUAPQhiGGGJmXoys5CF5/i6h4+vdzGe5X3uzxFWCiYDfCLxLNMNi3ideHrT0jnvE0dYWVKIz4nHDLog8SPXZZffOJccFnhmxMim54gjxGKpg+UOZmVDJZ4ijiqqRvlCzmWF8xZntVJjrXvyF4YK2nKG6zSHkMAikkhBhIwaNlCBhRitGikm0rQf9/APOv4UuWRybYCRYx5VqJAcP/gf/O7WLE5OuEmhOND1YtsfI0BwF2jWbfv72LabJ4D/GbjS2v5qA5j5JL3e1qJHQN82cHHd1uQ94HIHGHjSJUNyJD9NoVgE3s/om/JA/y3Qu+r21trH6QOQpa6WboCDQ2C0RNlrHu/u7uzt3zOt/n4AKiByitGsOMYAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfkBAkJMCAicDfKAAAARElEQVQI13WKIQ7AMAzE3JLQSm3agWnT/v/CkGygASED1lnWFRV5mxkTGMEMNHkHtIC0dNLw9dN6BTmAC7iBJ3yv+8kHKRwH7I3cRvoAAAAASUVORK5CYII=",
            "Viridis": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAABCAIAAAAw6DswAAADOnpUWHRSYXcgcHJvZmlsZSB0eXBlIGV4aWYAAHjarZRpjiQpDIX/c4o5QnjDcBxWaW4wx58HQWZWZlWPNK0GxYJxGPt9BGH88/cMf6HRxSmoeYo5xgtNs2YueEnX3e4nXbrvu/GZwvjNHh4v8KBL8JR7GMfxL7Db6wPXY6/v9uDtxEkn0CPwCShr5ZVGP0meQMK3nc445JNriV/KOddsnJfJ6j31OVaHGN0QTzjwEJJr3/leSe6r4NJ9x1qYJbyrJNxZ5Lt+4SndDwI+Rf/Q72rHQ15y3IEeZcUPnY6d7Gf9tkpfMyI+LvyaWG20F+1v+s2e5hx3dUVjgFzxFPUocb/BEZLqrUZEd1yGd989o6erXA3UOkqt4aoYZGIoPkmpU6FJYz8bNaSoPNjxZG4s25bEOXOThUBXp8keJEsHC5YGcgIzP3OhvW5e62GxhJU7wZMJwcD4vYdPw+/2t0Bzrm1OdASlGzAvwZHGIrfu8AIQmkdT2/pSuB/XZ1tgBQRty5xQYLnqHaIavfaWbM5yWYCrXvf/Qt5PAEiEtQ3JYEcrXZHEKNLlzE4EHRP4FGTOolxBgCwYd2TJKhIBJ/FaG984bV82vs04XgDCJIoDTZYCWKqmEf9bwhYqwcTUzKK5JctWokSNFmP0uM6p4uLq5tHdk2cvSZImSzF5SimnkjkLjjELOWbPKedcChYtWhCrwL/AULlK1Wo1Vq+p5loatk/TZi02b6nlVjp36TgCQo/de+q5l0EDW2nosBGHjzTyKBN7bcrUaTNOn2nmWZ7UDtV3ap/k/psaHWq8QS0/f1GD2f0RgtZxYosZiLESiPsigA3Ni9mVSJUXucXsyixBxBhZ2oLTaREDQR3ENunJ7kXul9wC1P2/3PgncmGh+xPkwkL3hdx3bj9Q62Uft7IBrb8QmuKEFPx+k6lUUSMbg7EvMqRCTpxgzUWxGP4RNfwjLUEqWzO6BxEFYJBDdNbk+HRFudqI+ZooOhWUFF0U3+W55jJCDoXfXB82xJHKhuqXax5BY3ysh5CtqiH8WJMJcmtTlNf2bK4mhXrGNimVdvbWdSQvpC2HcVcwuRRX6Siov75lGqmLQJUc/gWKktqrxMhodAAAAYVpQ0NQSUNDIHByb2ZpbGUAAHicfZE9SMNAHMVf00pVWhzsICKYoTpZEBVxlCoWwUJpK7TqYHLph9CkIUlxcRRcCw5+LFYdXJx1dXAVBMEPECdHJ0UXKfF/SaFFjAfH/Xh373H3DhAaFaaagXFA1SwjnYiLufyKGHxFAD0IYhhhiZl6MrOQhef4uoePr3cxnuV97s8RVgomA3wi8SzTDYt4nXh609I57xNHWFlSiM+Jxwy6IPEj12WX3ziXHBZ4ZsTIpueII8RiqYPlDmZlQyWeIo4qqkb5Qs5lhfMWZ7VSY6178heGCtpyhus0h5DAIpJIQYSMGjZQgYUYrRopJtK0H/fwDzr+FLlkcm2AkWMeVaiQHD/4H/zu1ixOTrhJoTjQ9WLbHyNAcBdo1m37+9i2myeA/xm40tr+agOY+SS93taiR0DfNnBx3dbkPeByBxh40iVDciQ/TaFYBN7P6JvyQP8t0Lvq9tbax+kDkKWulm6Ag0NgtETZax7v7u7s7d8zrf5+ACogcorRrDjGAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAB3RJTUUH5AQJCTAXms2SxQAAAFtJREFUCNcFwYkNgCAMAMDytgViNIobOYT7b+CTEG3RO7OF3ZZicoLMPaGmoOyUvbAVBiGjZARBCZS+jp8QACqQRhLCN+MzYBtjm+I9x3vxZw3n6o7qr2qfavEHhDge/yNMINEAAAAASUVORK5CYII=",
            "Rainbow": "data:image/png;base64,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",
            "Plasma": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAABCAYAAAC/iqxnAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TSlVaHOwgIpihOlkQFXGUKhbBQmkrtOpgcumH0KQhSXFxFFwLDn4sVh1cnHV1cBUEwQ8QJ0cnRRcp8X9JoUWMB8f9eHfvcfcOEBoVppqBcUDVLCOdiIu5/IoYfEUAPQhiGGGJmXoys5CF5/i6h4+vdzGe5X3uzxFWCiYDfCLxLNMNi3ideHrT0jnvE0dYWVKIz4nHDLog8SPXZZffOJccFnhmxMim54gjxGKpg+UOZmVDJZ4ijiqqRvlCzmWF8xZntVJjrXvyF4YK2nKG6zSHkMAikkhBhIwaNlCBhRitGikm0rQf9/APOv4UuWRybYCRYx5VqJAcP/gf/O7WLE5OuEmhOND1YtsfI0BwF2jWbfv72LabJ4D/GbjS2v5qA5j5JL3e1qJHQN82cHHd1uQ94HIHGHjSJUNyJD9NoVgE3s/om/JA/y3Qu+r21trH6QOQpa6WboCDQ2C0RNlrHu/u7uzt3zOt/n4AKiByitl/8gEAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfkBAkJLDTe3b7qAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAF1JREFUCNcFwYEVgyAMQMGvIpAE+tymU3ZfEhV6t335LaPSOFEyRkI5MHaUhTERXqTcyBVUc6oFRQdFnSKDLE7WIOvglCCpk3SQzDnM2c3ZmrOaM3sw+8vzWURf/AFWPSD2bbx7BgAAAABJRU5ErkJggg==",
            "Color brewer: orange purple": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAABCAYAAAC/iqxnAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TSlVaHOwgIpihOlkQFXGUKhbBQmkrtOpgcumH0KQhSXFxFFwLDn4sVh1cnHV1cBUEwQ8QJ0cnRRcp8X9JoUWMB8f9eHfvcfcOEBoVppqBcUDVLCOdiIu5/IoYfEUAPQhiGGGJmXoys5CF5/i6h4+vdzGe5X3uzxFWCiYDfCLxLNMNi3ideHrT0jnvE0dYWVKIz4nHDLog8SPXZZffOJccFnhmxMim54gjxGKpg+UOZmVDJZ4ijiqqRvlCzmWF8xZntVJjrXvyF4YK2nKG6zSHkMAikkhBhIwaNlCBhRitGikm0rQf9/APOv4UuWRybYCRYx5VqJAcP/gf/O7WLE5OuEmhOND1YtsfI0BwF2jWbfv72LabJ4D/GbjS2v5qA5j5JL3e1qJHQN82cHHd1uQ94HIHGHjSJUNyJD9NoVgE3s/om/JA/y3Qu+r21trH6QOQpa6WboCDQ2C0RNlrHu/u7uzt3zOt/n4AKiByitl/8gEAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfkBAkJNSPGDpI1AAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAG1JREFUCNclxVESgiAUQNHrhGKATaa2u/bZpphmFHioKX10fk71fulijcJZhbUXrs7RdgP6NqG7AeVGMBOVeYIZKe2Ds7lTmp6z7tlLTV4Pcj7+y5cUViRspLARl0yYE8ssLHMifoToheCF5IUfnfI1FTW3dhwAAAAASUVORK5CYII=",
            "Color brewer: pink purple": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAABCAYAAAC/iqxnAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TSlVaHOwgIpihOlkQFXGUKhbBQmkrtOpgcumH0KQhSXFxFFwLDn4sVh1cnHV1cBUEwQ8QJ0cnRRcp8X9JoUWMB8f9eHfvcfcOEBoVppqBcUDVLCOdiIu5/IoYfEUAPQhiGGGJmXoys5CF5/i6h4+vdzGe5X3uzxFWCiYDfCLxLNMNi3ideHrT0jnvE0dYWVKIz4nHDLog8SPXZZffOJccFnhmxMim54gjxGKpg+UOZmVDJZ4ijiqqRvlCzmWF8xZntVJjrXvyF4YK2nKG6zSHkMAikkhBhIwaNlCBhRitGikm0rQf9/APOv4UuWRybYCRYx5VqJAcP/gf/O7WLE5OuEmhOND1YtsfI0BwF2jWbfv72LabJ4D/GbjS2v5qA5j5JL3e1qJHQN82cHHd1uQ94HIHGHjSJUNyJD9NoVgE3s/om/JA/y3Qu+r21trH6QOQpa6WboCDQ2C0RNlrHu/u7uzt3zOt/n4AKiByitl/8gEAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfkBAkJNDayyEefAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAFFJREFUCNclxUESwzAIBMHJ/z/rgi3bIKHNwX3pn3XZa0E37m/qxVVQBe/Cz8A93xocjWPhWEwOlUPloXN4ciMVikZq1JvkEBwSIwYxpDdi+AMwelG66MEL3gAAAABJRU5ErkJggg==",
            "Color brewer: brown teal": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAABCAYAAAC/iqxnAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TSlVaHOwgIpihOlkQFXGUKhbBQmkrtOpgcumH0KQhSXFxFFwLDn4sVh1cnHV1cBUEwQ8QJ0cnRRcp8X9JoUWMB8f9eHfvcfcOEBoVppqBcUDVLCOdiIu5/IoYfEUAPQhiGGGJmXoys5CF5/i6h4+vdzGe5X3uzxFWCiYDfCLxLNMNi3ideHrT0jnvE0dYWVKIz4nHDLog8SPXZZffOJccFnhmxMim54gjxGKpg+UOZmVDJZ4ijiqqRvlCzmWF8xZntVJjrXvyF4YK2nKG6zSHkMAikkhBhIwaNlCBhRitGikm0rQf9/APOv4UuWRybYCRYx5VqJAcP/gf/O7WLE5OuEmhOND1YtsfI0BwF2jWbfv72LabJ4D/GbjS2v5qA5j5JL3e1qJHQN82cHHd1uQ94HIHGHjSJUNyJD9NoVgE3s/om/JA/y3Qu+r21trH6QOQpa6WboCDQ2C0RNlrHu/u7uzt3zOt/n4AKiByitl/8gEAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfkBAkJJSlsGWl6AAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAFdJREFUCNdlxkEOQDAQQNHfMFQ0M9zOtZy0CZW2C2HBRix+/nPrMl/BlDApYTKCPh7VkEGRwWi9If51b5yNpzih0lERCkJ1HccJsWRizr9vKX3bd7aUuAHr4i3WlWQQTAAAAABJRU5ErkJggg==",
            "Color brewer: purple green": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAABCAYAAAC/iqxnAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TSlVaHOwgIpihOlkQFXGUKhbBQmkrtOpgcumH0KQhSXFxFFwLDn4sVh1cnHV1cBUEwQ8QJ0cnRRcp8X9JoUWMB8f9eHfvcfcOEBoVppqBcUDVLCOdiIu5/IoYfEUAPQhiGGGJmXoys5CF5/i6h4+vdzGe5X3uzxFWCiYDfCLxLNMNi3ideHrT0jnvE0dYWVKIz4nHDLog8SPXZZffOJccFnhmxMim54gjxGKpg+UOZmVDJZ4ijiqqRvlCzmWF8xZntVJjrXvyF4YK2nKG6zSHkMAikkhBhIwaNlCBhRitGikm0rQf9/APOv4UuWRybYCRYx5VqJAcP/gf/O7WLE5OuEmhOND1YtsfI0BwF2jWbfv72LabJ4D/GbjS2v5qA5j5JL3e1qJHQN82cHHd1uQ94HIHGHjSJUNyJD9NoVgE3s/om/JA/y3Qu+r21trH6QOQpa6WboCDQ2C0RNlrHu/u7uzt3zOt/n4AKiByitl/8gEAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfkBAkJJguSVHtdAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAGhJREFUCNdFxUsOwiAUQNGrpNIA7YC4E5fnCrpYPuEZX1ojOOjAMzmX52MbPgb8PeBjwMWAjw63zvjF4hZ7vlqm2WBuBmP/92vnGDufsXP0c/0qRStVK0UL5V3JWsjSyPIiNSGJkJrwA38hMN2MYoeyAAAAAElFTkSuQmCC",
            "Color brewer: red blue": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAABCAYAAAC/iqxnAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TSlVaHOwgIpihOlkQFXGUKhbBQmkrtOpgcumH0KQhSXFxFFwLDn4sVh1cnHV1cBUEwQ8QJ0cnRRcp8X9JoUWMB8f9eHfvcfcOEBoVppqBcUDVLCOdiIu5/IoYfEUAPQhiGGGJmXoys5CF5/i6h4+vdzGe5X3uzxFWCiYDfCLxLNMNi3ideHrT0jnvE0dYWVKIz4nHDLog8SPXZZffOJccFnhmxMim54gjxGKpg+UOZmVDJZ4ijiqqRvlCzmWF8xZntVJjrXvyF4YK2nKG6zSHkMAikkhBhIwaNlCBhRitGikm0rQf9/APOv4UuWRybYCRYx5VqJAcP/gf/O7WLE5OuEmhOND1YtsfI0BwF2jWbfv72LabJ4D/GbjS2v5qA5j5JL3e1qJHQN82cHHd1uQ94HIHGHjSJUNyJD9NoVgE3s/om/JA/y3Qu+r21trH6QOQpa6WboCDQ2C0RNlrHu/u7uzt3zOt/n4AKiByitl/8gEAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfkBAkJJju0jUvxAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAGVJREFUCNdVxUEOgjAQQNGvtYa2GgyIB/AE3t5LuWKqyUwo40I3LF7e7nl/+OmWKVPhdyZdzxwuA6Ef2fcj4c+7gseExw6PmfWYWAhoc3RxtK1ocz7WeL1tqxpzVUQMqcosShXjC794NUJ9t1wfAAAAAElFTkSuQmCC",
            "Color brewer: red green": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAABCAYAAAC/iqxnAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TSlVaHOwgIpihOlkQFXGUKhbBQmkrtOpgcumH0KQhSXFxFFwLDn4sVh1cnHV1cBUEwQ8QJ0cnRRcp8X9JoUWMB8f9eHfvcfcOEBoVppqBcUDVLCOdiIu5/IoYfEUAPQhiGGGJmXoys5CF5/i6h4+vdzGe5X3uzxFWCiYDfCLxLNMNi3ideHrT0jnvE0dYWVKIz4nHDLog8SPXZZffOJccFnhmxMim54gjxGKpg+UOZmVDJZ4ijiqqRvlCzmWF8xZntVJjrXvyF4YK2nKG6zSHkMAikkhBhIwaNlCBhRitGikm0rQf9/APOv4UuWRybYCRYx5VqJAcP/gf/O7WLE5OuEmhOND1YtsfI0BwF2jWbfv72LabJ4D/GbjS2v5qA5j5JL3e1qJHQN82cHHd1uQ94HIHGHjSJUNyJD9NoVgE3s/om/JA/y3Qu+r21trH6QOQpa6WboCDQ2C0RNlrHu/u7uzt3zOt/n4AKiByitl/8gEAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfkBAkJJxQGR0fpAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAF9JREFUCNdVxjEWgyAQQMGPvOA26EFygNz/GLlDpAoP2EVMYSysZtz79TzCIoRVCOvM9cciEAUXBeJ8ew8enUAnMH+qHuoxyNbI1vhaI5v+r6Ta2coglUGqO5+yk8rgBxeBLw+m/1kfAAAAAElFTkSuQmCC",
            "Color brewer: red gray": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAABCAYAAAC/iqxnAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TSlVaHOwgIpihOlkQFXGUKhbBQmkrtOpgcumH0KQhSXFxFFwLDn4sVh1cnHV1cBUEwQ8QJ0cnRRcp8X9JoUWMB8f9eHfvcfcOEBoVppqBcUDVLCOdiIu5/IoYfEUAPQhiGGGJmXoys5CF5/i6h4+vdzGe5X3uzxFWCiYDfCLxLNMNi3ideHrT0jnvE0dYWVKIz4nHDLog8SPXZZffOJccFnhmxMim54gjxGKpg+UOZmVDJZ4ijiqqRvlCzmWF8xZntVJjrXvyF4YK2nKG6zSHkMAikkhBhIwaNlCBhRitGikm0rQf9/APOv4UuWRybYCRYx5VqJAcP/gf/O7WLE5OuEmhOND1YtsfI0BwF2jWbfv72LabJ4D/GbjS2v5qA5j5JL3e1qJHQN82cHHd1uQ94HIHGHjSJUNyJD9NoVgE3s/om/JA/y3Qu+r21trH6QOQpa6WboCDQ2C0RNlrHu/u7uzt3zOt/n4AKiByitl/8gEAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfkBAkJNQxt369sAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAF5JREFUCNdVw8ENwyAMQNEPVRXcCBK8QSbo9t3LIAyHSu05T3rhc71/ooJoQlSQurNpJtXMVjPP8yTmyqMosVTCfhBSgddBkMKXyFrr1t2Zc+LujDHovd+aGWZGa40/OBUv+r839nUAAAAASUVORK5CYII=",
            "Color brewer: pink green": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAABCAYAAAC/iqxnAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TSlVaHOwgIpihOlkQFXGUKhbBQmkrtOpgcumH0KQhSXFxFFwLDn4sVh1cnHV1cBUEwQ8QJ0cnRRcp8X9JoUWMB8f9eHfvcfcOEBoVppqBcUDVLCOdiIu5/IoYfEUAPQhiGGGJmXoys5CF5/i6h4+vdzGe5X3uzxFWCiYDfCLxLNMNi3ideHrT0jnvE0dYWVKIz4nHDLog8SPXZZffOJccFnhmxMim54gjxGKpg+UOZmVDJZ4ijiqqRvlCzmWF8xZntVJjrXvyF4YK2nKG6zSHkMAikkhBhIwaNlCBhRitGikm0rQf9/APOv4UuWRybYCRYx5VqJAcP/gf/O7WLE5OuEmhOND1YtsfI0BwF2jWbfv72LabJ4D/GbjS2v5qA5j5JL3e1qJHQN82cHHd1uQ94HIHGHjSJUNyJD9NoVgE3s/om/JA/y3Qu+r21trH6QOQpa6WboCDQ2C0RNlrHu/u7uzt3zOt/n4AKiByitl/8gEAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfkBAkJNTar03beAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAG5JREFUCNcFwWEOgiAYgOE3CXJCm60f3KCLdrkuoyzATxwYPc/l83p34x3GO27+jn5a9GzRD4eeJ65uRFmDsho1GRgV3Qz8zEDXA6dq1C40hNaFckZyXdnqQq4L6QjEfeUrgbgHkiSSFPJWSFL4Ayk+Mw4lpeJYAAAAAElFTkSuQmCC",
            "Color brewer: spectral": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAABCAYAAAC/iqxnAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TSlVaHOwgIpihOlkQFXGUKhbBQmkrtOpgcumH0KQhSXFxFFwLDn4sVh1cnHV1cBUEwQ8QJ0cnRRcp8X9JoUWMB8f9eHfvcfcOEBoVppqBcUDVLCOdiIu5/IoYfEUAPQhiGGGJmXoys5CF5/i6h4+vdzGe5X3uzxFWCiYDfCLxLNMNi3ideHrT0jnvE0dYWVKIz4nHDLog8SPXZZffOJccFnhmxMim54gjxGKpg+UOZmVDJZ4ijiqqRvlCzmWF8xZntVJjrXvyF4YK2nKG6zSHkMAikkhBhIwaNlCBhRitGikm0rQf9/APOv4UuWRybYCRYx5VqJAcP/gf/O7WLE5OuEmhOND1YtsfI0BwF2jWbfv72LabJ4D/GbjS2v5qA5j5JL3e1qJHQN82cHHd1uQ94HIHGHjSJUNyJD9NoVgE3s/om/JA/y3Qu+r21trH6QOQpa6WboCDQ2C0RNlrHu/u7uzt3zOt/n4AKiByitl/8gEAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfkBAkJKA58vaJcAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAGhJREFUCNcFwVEOgjAQQMG33UgLtATP5Lf39xRoS8B046oz8rjdf2N2YnZSdi6LEtaIXhNhjcgyQpmRPEOZYMqQCpIKpIIHofuJfU/M3xwfp5pSTWmmvLqwGTy7sHVoh7LXgVYH9hb5A6mSKIFBSb+3AAAAAElFTkSuQmCC",
        }
    }
}